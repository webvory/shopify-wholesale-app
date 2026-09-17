import { Link } from "react-router";
import { RegistrationNav } from "../components/registration/AdminUI";
import { TEMPLATES } from "../registration/schema";
export { templatesLoader as loader } from "../registration/pages.server";
export default function RegistrationTemplates() {
  return (
    <>
      <RegistrationNav />
      <s-page heading="Registration templates">
        <div className="registration-admin">
          <p className="registration-lede">
            Start with a considered structure, then make every field, section,
            and detail your own.
          </p>
          <section
            className="registration-panel registration-template-list"
            aria-label="Available templates"
          >
            {TEMPLATES.map((template, index) => (
              <article className="registration-template" key={template.id}>
                <span className="registration-template-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2>{template.name}</h2>
                  <p>{template.description}</p>
                  <span className="registration-muted">
                    Fully editable · Mobile ready
                  </span>
                </div>
                <Link
                  className="registration-button"
                  to={`/app/registration-pages?template=${encodeURIComponent(template.id)}`}
                >
                  Use template →
                </Link>
              </article>
            ))}
          </section>
        </div>
      </s-page>
    </>
  );
}
