import { useLoaderData, useSearchParams } from "react-router";
import RegistrationBuilder from "../components/registration/RegistrationBuilder";
export {
  editorLoader as loader,
  editorAction as action,
} from "../registration/pages.server";
export default function RegistrationEditor() {
  const data = useLoaderData();
  const [searchParams] = useSearchParams();
  return (
    <RegistrationBuilder
      key={data.page.id}
      {...data}
      initialPreview={searchParams.get("preview") === "1"}
    />
  );
}
