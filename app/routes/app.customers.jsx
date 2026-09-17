import { useFetcher } from "react-router";
import { authenticate } from "../shopify.server";

/*
LOADER
*/
export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return {};
};


/*
ACTION
*/
export const action = async ({ request }) => {

  const { admin } = await authenticate.admin(request);

  const formData = await request.formData();

  let customerId = formData.get("customerId");
  const tag = formData.get("tag");

  // clean ID
  customerId = customerId.replace(/[^0-9]/g, "");

  const gid = `gid://shopify/Customer/${customerId}`;

  const response = await admin.graphql(
    `
    mutation addTag($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) {
        node { id }
        userErrors { message }
      }
    }
    `,
    {
      variables: {
        id: gid,
        tags: [tag],
      },
    }
  );

  const json = await response.json();

  if (json.data.tagsAdd.userErrors.length) {
    return { error: json.data.tagsAdd.userErrors[0].message };
  }

  return { success: true };
};



export default function CustomersPage() {

  const fetcher = useFetcher();

  return (

    <s-page heading="Wholesale Customers">

      <s-section heading="Assign Wholesale Tag">

        <fetcher.Form method="post">

          <s-text-field
            label="Customer ID or Shopify URL"
            name="customerId"
            help-text="Paste customer ID or Shopify customer URL"
          />

          <s-text-field
            label="Wholesale Tag"
            name="tag"
            value="wholesale"
          />

          <s-button
            type="submit"
            variant="primary"
          >
            Assign Tag
          </s-button>

        </fetcher.Form>


        {fetcher.data?.success && (
          <s-banner tone="success">
            Tag added successfully
          </s-banner>
        )}

        {fetcher.data?.error && (
          <s-banner tone="critical">
            {fetcher.data.error}
          </s-banner>
        )}

      </s-section>

    </s-page>

  );
}