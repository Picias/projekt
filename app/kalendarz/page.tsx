import { redirect } from "next/navigation";

// Kalendarz posiedzeń z porządkiem obrad żyje na stronie Obrady — zamiast
// zaślepki „wkrótce” prowadzimy tam od razu.
export default function KalendarzPage() {
  redirect("/obrady");
}
