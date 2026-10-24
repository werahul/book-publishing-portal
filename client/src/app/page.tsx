import { redirect } from "next/navigation";

// src/proxy.ts sends signed-in users to their portal before this renders.
export default function Home() {
  redirect("/login");
}
