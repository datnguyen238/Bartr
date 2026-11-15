import { redirect } from "next/navigation";

export default function DiscoverPage() {
  redirect("/?view=matches#browse");
}
