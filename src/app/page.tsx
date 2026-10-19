import { redirect } from "next/navigation";

// El proxy ya envía "/" al panel o al login; esto cubre el caso sin proxy (por ejemplo, una exportación estática).
export default function Home() {
  redirect("/panel");
}
