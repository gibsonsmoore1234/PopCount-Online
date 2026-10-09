import { redirect } from "next/navigation";

/** Pop Count has no sign-up: everyone is anonymous. */
export default function SignupPage() {
  redirect("/");
}
