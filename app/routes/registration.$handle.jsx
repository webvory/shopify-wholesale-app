import { useCallback, useEffect, useState } from "react";
import {
  useFetcher,
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
} from "react-router";
import FormRenderer, {
  formStyle,
} from "../components/registration/FormRenderer";
import { allFields } from "../registration/schema.js";
export {
  publicLoader as loader,
  publicAction as action,
} from "../registration/submission.server.js";

export const meta = () => [
  { title: "Wholesale registration" },
  { name: "robots", content: "noindex, nofollow" },
];
export function headers() {
  return {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "frame-ancestors https: http://localhost:*",
  };
}
export default function RegistrationForm() {
  const { configuration, styling, nonce, success } = useLoaderData();
  const fetcher = useFetcher();
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      allFields(configuration)
        .filter((field) => field.defaultValue !== undefined)
        .map((field) => [field.id, field.defaultValue]),
    ),
  );
  const change = useCallback(
    (id, value) => setValues((old) => ({ ...old, [id]: value })),
    [],
  );
  useEffect(() => {
    const resize = () =>
      window.parent.postMessage(
        { type: "wholesale-form-height", height: document.body.scrollHeight },
        "*",
      );
    const observer = new ResizeObserver(resize);
    observer.observe(document.body);
    resize();
    return () => observer.disconnect();
  }, []);
  const submit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    // FormData includes native controls; validate against the published config on the server.
    fetcher.submit(form, { method: "post", encType: "multipart/form-data" });
  };
  return (
    <main
      style={{
        ...formStyle(styling),
        background: styling.pageBackground,
        padding: "clamp(12px, 3vw, 32px)",
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {fetcher.data?.ok ? (
          <section className="reg-form" role="status">
            <h1>{success.heading}</h1>
            <p>{success.description}</p>
            {success.redirectUrl && (
              <a
                href={success.redirectUrl}
                target="_top"
                className="reg-submit"
              >
                {success.buttonText || "Continue"}
              </a>
            )}
          </section>
        ) : (
          <form method="post" encType="multipart/form-data" onSubmit={submit}>
            <input type="hidden" name="nonce" value={nonce} />
            <div
              style={{
                position: "absolute",
                left: "-10000px",
                width: 1,
                height: 1,
                overflow: "hidden",
              }}
              aria-hidden="true"
            >
              <label>
                Leave this field blank
                <input
                  name="website_confirmation"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </label>
            </div>
            {fetcher.data?.error && (
              <p role="alert" className="reg-error">
                {fetcher.data.error}
              </p>
            )}
            <FormRenderer
              configuration={configuration}
              styling={styling}
              values={values}
              onChange={change}
              errors={fetcher.data?.errors || {}}
              disabled={fetcher.state !== "idle"}
            />
            <div
              style={{
                textAlign: styling.buttonAlignment || "left",
                marginTop: 20,
              }}
            >
              <button
                className="reg-submit"
                type="submit"
                disabled={fetcher.state !== "idle"}
                style={{
                  background: styling.buttonColor,
                  color: styling.buttonTextColor,
                  borderRadius: styling.buttonRadius,
                  width: styling.buttonWidth === "full" ? "100%" : "auto",
                  border: 0,
                  padding: "14px 24px",
                  cursor: "pointer",
                }}
              >
                {fetcher.state !== "idle" ? "Submitting…" : styling.buttonText}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <main style={{ padding: 32, fontFamily: "system-ui" }}>
      <h1>Registration unavailable</h1>
      <p>
        {isRouteErrorResponse(error)
          ? String(error.data)
          : "Please reopen this page from the store or try again later."}
      </p>
    </main>
  );
}
