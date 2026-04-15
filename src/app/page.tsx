import { redirect } from "next/navigation";

export default async function Dashboard(props: {
  searchParams: Promise<{ project?: string }>;
}) {
  const searchParams = await props.searchParams;
  const projectParam = searchParams?.project || "all";

  // Redirect the root dashboard to the new dynamic route architecture
  // This resolves the TypeScript error by consolidating the dashboard implementation
  redirect(`/dashboard/${projectParam}`);
}
