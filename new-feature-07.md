# Master Architecture Blueprint: Enterprise CRM, AI Copilot & KPI Engine for Online Sales
**Version:** 1.0.0  
**Target Tech Stack:** LINE Messaging API, PostgreSQL (with `pgvector`), n8n / Node.js Backend, Google Gemini Flash Lite 3.1, Google Looker Studio, Custom Chat Inbox (Web/App).  
**Objective:** สถาปัตยกรรมระบบจัดการลูกค้าสัมพันธ์ (CRM) ที่เชื่อมต่อระบบวัดผลพนักงานขาย (KPI/SLA) และระบบตอบกลับอัตโนมัติด้วย AI Copilot โดยไม่ใช้แพลตฟอร์มสำเร็จรูป

---

## 1. System Architecture Overview

ระบบถูกออกแบบโดยใช้ **PostgreSQL เป็น Single Source of Truth (SSOT)** สำหรับเก็บข้อมูลทั้ง 3 โดเมน ได้แก่ ข้อมูลลูกค้า (CRM), ประวัติการโต้ตอบและเวลา (Chat Logs/KPI) และคลังความรู้ AI (Knowledge Base via Vector Embeddings)


```

[ LINE OA / Channels ]
│
▼ (Webhook)
[ Debouncer / Buffer Engine ] (รอ 3-5 วินาที รวมข้อความต่อเนื่อง)
│
▼
[ n8n / Node.js Backend API ] ◄──► [ Google Embedding API (text-embedding-004) ]
│                     ◄──► [ Google Gemini Flash Lite 3.1 (LLM Engine) ]
│
├──(REST / WebSocket)──► [ Custom Chat Inbox (UI สำหรับแอดมิน) ]
│
▼ (Read/Write via Connection Pool)
[ PostgreSQL Database + pgvector ]
│
▼ (Materialized View / Read-Only Replica)
[ Google Looker Studio Dashboard ]

```

---

## 2. Complete Database Schema (PostgreSQL DDL)

ต้องติดตั้ง Extension `pgvector` ก่อนรันสคริปต์สร้างตาราง เพื่อรองรับ Semantic Search

```sql
-- Enable Vector Extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. ตารางเก็บข้อมูลพนักงานแอดมินและการเข้ากะ
CREATE TABLE admins (
    admin_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    role VARCHAR(20) DEFAULT 'junior' CHECK (role IN ('junior', 'supervisor', 'owner')),
    is_active BOOLEAN DEFAULT TRUE,
    shift_start TIME DEFAULT '08:00:00',
    shift_end TIME DEFAULT '22:00:00',
    last_assigned_at TIMESTAMPTZ DEFAULT '1970-01-01 00:00:00Z'
);

-- 2. ตารางโปรโมชั่นและโค้ดส่วนลด (Discount Guardrails)
CREATE TABLE promotions (
    promo_id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL, -- e.g., 'SAVE5'
    description TEXT,
    discount_value DECIMAL(10, 2) NOT NULL,
    min_order_amount DECIMAL(10, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ
);

-- 3. ตารางลูกค้า (CRM Core)
CREATE TABLE customers (
    user_id VARCHAR(50) PRIMARY KEY, -- LINE User ID
    display_name VARCHAR(100),
    phone_number VARCHAR(20), -- Subject to PII Masking
    address TEXT,             -- Subject to PII Masking
    tier VARCHAR(20) DEFAULT 'Lead' CHECK (tier IN ('Lead', 'Regular', 'VIP')),
    stage VARCHAR(50) DEFAULT 'New' CHECK (stage IN ('New', 'Interested', 'Pending Payment', 'Closed')),
    assigned_admin_id INT REFERENCES admins(admin_id),
    custom_attributes JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_stage_tier ON customers(stage, tier);
CREATE INDEX idx_customers_assigned_admin ON customers(assigned_admin_id);

-- 4. ตารางบันทึกแชทและการจับเวลา SLA (Chat Logs & KPI Engine)
CREATE TABLE chat_messages (
    message_id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES customers(user_id),
    admin_id INT NULL REFERENCES admins(admin_id),
    sender_type VARCHAR(10) CHECK (sender_type IN ('customer', 'admin', 'bot')),
    message_text TEXT NOT NULL,
    reply_token VARCHAR(100) NULL,
    is_first_in_session BOOLEAN DEFAULT FALSE,
    responded_at TIMESTAMPTZ NULL,
    response_time_seconds INT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_user_created ON chat_messages(user_id, created_at DESC);
CREATE INDEX idx_chat_kpi_calc ON chat_messages(admin_id, created_at) WHERE sender_type = 'admin';

-- 5. ตารางยอดขาย (Orders)
CREATE TABLE orders (
    order_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES customers(user_id),
    admin_id INT REFERENCES admins(admin_id),
    promo_id INT NULL REFERENCES promotions(promo_id),
    total_amount DECIMAL(10, 2) NOT NULL,
    discount_amount DECIMAL(10, 2) DEFAULT 0.00,
    shipping_fee_discount DECIMAL(10, 2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_admin_date ON orders(admin_id, created_at);

-- 6. ตารางประวัติการโอนเคสระหว่างแอดมิน (Escalation & Case Transfer)
CREATE TABLE case_transfers (
    transfer_id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES customers(user_id),
    from_admin_id INT REFERENCES admins(admin_id),
    to_admin_id INT REFERENCES admins(admin_id),
    reason TEXT,
    transferred_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. ตารางการตั้งค่าบอทและบุคลิก (AI Settings)
CREATE TABLE bot_settings (
    setting_id SERIAL PRIMARY KEY,
    system_prompt TEXT NOT NULL,
    temperature DECIMAL(3, 2) DEFAULT 0.20,
    confidence_threshold DECIMAL(3, 2) DEFAULT 0.75
);

-- 8. ตารางความรู้บอทและ Vector Embeddings (AI Knowledge Base)
CREATE TABLE bot_knowledge_base (
    rule_id SERIAL PRIMARY KEY,
    intent_name VARCHAR(100) NOT NULL,
    sample_utterances TEXT[] NOT NULL,
    embedding vector(768), -- Dimension สำหรับโมเดล text-embedding-004
    response_type VARCHAR(20) CHECK (response_type IN ('direct_reply', 'llm_generate', 'human_handoff')),
    target_response TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. Materialized View สำหรับ Looker Studio Dashboard (Analytics Engine)
CREATE MATERIALIZED VIEW mv_admin_kpi_daily AS
SELECT 
    DATE(c.created_at) AS work_date,
    a.username AS admin_name,
    COUNT(DISTINCT c.user_id) AS total_leads_handled,
    COUNT(c.message_id) AS total_replies,
    ROUND(AVG(c.response_time_seconds)::numeric, 2) AS avg_frt_seconds,
    COUNT(*) FILTER (WHERE c.response_time_seconds <= 600) AS sla_passed_count,
    COALESCE(SUM(o.total_amount), 0) AS total_sales,
    COUNT(DISTINCT o.order_id) AS total_orders,
    ROUND((COUNT(DISTINCT o.order_id)::numeric / NULLIF(COUNT(DISTINCT c.user_id), 0)) * 100, 2) AS conversion_rate_pct
FROM admins a
LEFT JOIN chat_messages c ON a.admin_id = c.admin_id AND c.sender_type = 'admin'
LEFT JOIN orders o ON a.admin_id = o.admin_id AND DATE(c.created_at) = DATE(o.created_at)
GROUP BY DATE(c.created_at), a.username;

CREATE UNIQUE INDEX idx_mv_admin_kpi_daily_date_admin ON mv_admin_kpi_daily(work_date, admin_name);

```

---

## 3. Core Processing Workflows (Backend & n8n Logic)

### Workflow 1: Inbound Webhook & Debouncer

1. **Receive Webhook:** รับ Payload จาก LINE Messaging API
2. **Debounce Buffer:** ดักจับข้อความจาก `userId` เดียวกันที่ส่งมาติดๆ กันภายใน 3-5 วินาที รวมเป็น 1 ข้อความ (Paragraph) เพื่อลดการเรียก LLM ซ้ำซ้อน
3. **Customer Upsert & Round-Robin Assignment:**
* ตรวจสอบ `user_id` ในตาราง `customers`
* หากเป็นลูกค้าใหม่ ให้ใช้ตรรกะ Round-Robin จ่ายงานให้แอดมิน:
```sql
INSERT INTO customers (user_id, display_name, assigned_admin_id)
VALUES (
    $1, $2,
    (SELECT admin_id FROM admins WHERE is_active = TRUE ORDER BY last_assigned_at ASC LIMIT 1)
) ON CONFLICT (user_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP;

```


* อัปเดต `last_assigned_at` ของแอดมินที่ได้รับงานเป็น `CURRENT_TIMESTAMP`


4. **Log Message:** บันทึกลงตาราง `chat_messages` (เซ็ต `is_first_in_session = TRUE` หากไม่มีการตอบกลับจากแอดมิน/บอทก่อนหน้านี้ในเซสชัน)
5. **Check Handoff Status:** หากลูกค้ารายนี้มีสถานะอยู่ในการดูแลของมนุษย์ (`human_handoff = TRUE`) ให้ข้าม Workflow AI แล้ว Push Notification ไปยัง Custom Inbox ทันที

### Workflow 2: AI Copilot & Semantic Search (Dynamic RAG)

1. **Vector Embedding:** ส่งข้อความของลูกค้าที่ผ่านการ Debounce แล้ว ไปยัง Google Embedding API (`text-embedding-004`) เพื่อแปลงเป็น Vector Array 768 มิติ
2. **Cosine Similarity Search:** ค้นหากฎในตาราง `bot_knowledge_base`
```sql
SELECT rule_id, intent_name, response_type, target_response, 
       1 - (embedding <=> $1) AS confidence_score
FROM bot_knowledge_base
WHERE is_active = TRUE
ORDER BY embedding <=> $1 LIMIT 1;

```


3. **Decision Branching:**
* **Case A: `confidence_score` < `bot_settings.confidence_threshold` (e.g., 0.75):**
เปลี่ยนสถานะเป็น Human Handoff -> แจ้งเตือนแอดมิน -> เริ่มนับเวลา FRT ของแอดมิน
* **Case B: `response_type` == 'direct_reply':**
ส่ง `target_response` กลับหาลูกค้าทันทีผ่าน LINE Reply API -> บันทึกลง `chat_messages` (`sender_type = 'bot'`)
* **Case C: `response_type` == 'llm_generate':**
ส่งต่อเข้า Workflow Gemini Flash Lite 3.1



### Workflow 3: Gemini Flash Lite 3.1 Generation & Fallback

**1. LLM Payload Configuration:**

```json
{
  "system_instruction": {
    "parts": [
      {
        "text": "คุณคือผู้ช่วยแอดมินตอบแชทของบริษัท (ดึงจาก bot_settings.system_prompt)\n\nกฎสำคัญ:\n1. อ้างอิงข้อมูลจาก [Knowledge Context] เท่านั้น ห้ามแต่งข้อมูลเอง\n2. หากคำถามนอกเหนือบริบท หรือลูกค้าขอคุยกับคน ให้ set 'need_human' เป็น true\n\n[Knowledge Context]:\n{target_response จาก DB}\n[Promotions Active]:\n{รายการโค้ดส่วนลดจากตาราง promotions ที่ is_active = true}"
      }
    ]
  },
  "contents": [
    {
      "role": "user",
      "parts": [{ "text": "{ข้อความลูกค้าที่ Debounce แล้ว}" }]
    }
  ],
  "generationConfig": {
    "temperature": 0.2,
    "response_mime_type": "application/json",
    "response_schema": {
      "type": "OBJECT",
      "properties": {
        "reply_text": { "type": "STRING" },
        "need_human": { "type": "BOOLEAN" }
      },
      "required": ["reply_text", "need_human"]
    }
  }
}

```

**2. Output Handling & Error Fallback:**

* หาก API สำเร็จและ `need_human == false`: ส่ง `reply_text` ตอบลูกค้า และบันทึกลง `chat_messages`
* **Fallback Rule:** หากเรียก Gemini API ล่ม, ติด Rate Limit หรือ `need_human == true`:
* ส่งข้อความสำรอง: *"ขออภัยในความล่าช้าค่ะ กำลังโอนสายให้แอดมินผู้เชี่ยวชาญดูแลต่อนะคะ"*
* ตั้งค่าสถานะเคสเป็น รอคนตอบ (Handoff) และ **บันทึก Timestamp เพื่อเริ่มต้นนับ FRT ให้แอดมิน**



### Workflow 4: Outbound Admin Reply & LINE Token Routing

1. รับคำสั่งส่งข้อความจาก Custom Inbox (`user_id`, `admin_id`, `message_text`)
2. **LINE Token Age Validation:** ตรวจสอบอายุของ `reply_token` ล่าสุดของลูกค้า
* **อายุ $\le$ 45 วินาที:** ยิง LINE Reply API (`/v2/bot/message/reply`) -> *ไม่เสียโควตาบรอดแคสต์*
* **อายุ > 45 วินาที หรือไม่มี Token:** ยิง LINE Push API (`/v2/bot/message/push`) -> *เสียโควตา*


3. **SLA Calculation & Log Update:**
```sql
WITH pending_msg AS (
    SELECT message_id, created_at FROM chat_messages 
    WHERE user_id = $1 AND is_first_in_session = TRUE AND responded_at IS NULL
    ORDER BY created_at ASC LIMIT 1
)
UPDATE chat_messages 
SET responded_at = CURRENT_TIMESTAMP,
    response_time_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - pending_msg.created_at))
FROM pending_msg
WHERE chat_messages.message_id = pending_msg.message_id;

```


4. บันทึกข้อความของแอดมินลง `chat_messages` (`sender_type = 'admin'`)

---

## 4. KPI & SLA Evaluation Rules (Guardrails)

ระบบคำนวณ KPI ต้องปฏิบัติตามกฎ 4 ข้อนี้ เพื่อป้องกันความคลาดเคลื่อนและความไม่ยุติธรรม:

1. **AI Handoff FRT Rule:** หากแชทถูกตอบโดย AI ก่อน แล้วมีการโอนต่อให้มนุษย์ (Handoff) เวลา $T_{\text{customer\_message}}$ สำหรับคิดค่า FRT ของแอดมิน **ต้องเริ่มนับตั้งแต่วินาทีที่ระบบส่งสัญญาณ Handoff** ไม่ใช่วินาทีแรกที่ลูกค้าทักเข้ามาในระบบ
2. **Operational Hours Rule:** การคำนวณ FRT จะต้องคิดเฉพาะในช่วงเวลาทำงาน (เช่น 08:00 - 22:00) หากลูกค้าทักมานอกเวลาทำการ ให้ปรับค่า $T_{\text{customer\_message}}$ ไปที่ `08:00:00` ของวันทำงานถัดไป
3. **Case Transfer Rule:** เมื่อแอดมิน A โอนเคสให้แอดมิน B
* ให้บันทึกลงตาราง `case_transfers`
* รีเซ็ต SLA การตอบกลับทันที (แอดมิน B เริ่มนับ FRT ใหม่ตั้งแต่ตอนรับโอน)
* หากปิดยอดขายได้ ให้หารยอดขายในตาราง `orders` ตามข้อตกลงบริษัท (เช่น Split Commission 50/50 หรือยกให้ Admin ผู้ปิดบิลสุดท้าย)


4. **Discount Abuse Prevention:** ค่าเฉลี่ยส่วนลดจะต้องคำนวณโดยรวม `shipping_fee_discount` เข้าไปกับ `discount_amount` เสมอ เพื่อป้องกันแอดมินเลี่ยง KPI โดยการแถมส่งฟรีแทนการลดราคาสินค้า

---

## 5. Security & Data Governance (PDPA / GDPR)

1. **Role-Based Access Control (RBAC):**
* `role = 'junior'`: บังคับเปิดใช้งาน PII Masking บนหน้า Custom Inbox UI
* เบอร์โทรศัพท์: แสดงเป็น `081-XXX-XX89`
* ที่อยู่: แสดงเฉพาะ จังหวัด และ รหัสไปรษณีย์


* `role = 'supervisor' / 'owner'`: สามารถมองเห็นข้อมูล PII แบบเต็มได้


2. **PII Unmasking Audit:**
* แอดมิน Junior จะมองเห็นข้อมูลจัดส่งแบบเต็มได้ **ต่อเมื่อสถานะออเดอร์ในตาราง `orders` ถูกเปลี่ยนเป็น `paid` (ชำระเงินแล้ว) เท่านั้น**
* ทุกครั้งที่มีการกด "ดูข้อมูลเต็ม (Unmask)" ระบบต้องบันทึก Audit Log (Who, When, Whose PII) ไว้เสมอเพื่อตรวจสอบย้อนหลัง


3. **Schedules & Maintenance:**
* ตั้งค่า Cron Job เพื่อรันคำสั่ง `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_admin_kpi_daily;` ทุกๆ 15 นาที เพื่อให้ Looker Studio ดึงข้อมูลได้อย่างรวดเร็วโดยไม่เกิด Database Lock
