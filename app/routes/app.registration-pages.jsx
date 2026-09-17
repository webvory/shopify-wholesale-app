import { Outlet } from "react-router";
import { RegistrationNav } from "../components/registration/AdminUI";
export default function RegistrationPagesLayout() {
  return (
    <>
      <RegistrationNav />
      <Outlet />
    </>
  );
}
