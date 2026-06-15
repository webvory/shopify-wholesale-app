import { useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";


/*
LOADER
Load rules from database
*/
export const loader = async ({ request }) => {

  const { session } = await authenticate.admin(request);

  const rules = await prisma.wholesaleDiscount.findMany({
    where:{
      shop: session.shop
    },
    orderBy:{
      createdAt:"desc"
    }
  });

  return { rules };

};


/*
ACTION
Create new discount rule
*/
export const action = async ({ request }) => {

  const { session } = await authenticate.admin(request);

  const formData = await request.formData();

  const tag = formData.get("tag");
  const discount = parseInt(formData.get("discount"));

  if(!tag || !discount){
    return { error:"Tag and discount required" };
  }

  await prisma.wholesaleDiscount.create({
    data:{
      shop: session.shop,
      tag,
      discount
    }
  });

  return { success:true };

};



/*
PAGE
*/
export default function Discounts() {

  const fetcher = useFetcher();
  const { rules } = useLoaderData();

  const [tag,setTag] = useState("");
  const [discount,setDiscount] = useState("");

  const createRule = () => {

    fetcher.submit(
      {
        tag,
        discount
      },
      { method:"POST" }
    );

  };


  return (

    <s-page heading="Wholesale Discount Rules">

      <s-section heading="Create Rule">

        <s-text-field
          label="Customer Tag"
          value={tag}
          onInput={(e)=>setTag(e.target.value)}
        />

        <s-text-field
          label="Discount %"
          value={discount}
          onInput={(e)=>setDiscount(e.target.value)}
        />

        <s-button
          variant="primary"
          onClick={createRule}
        >
          Create Rule
        </s-button>

        {fetcher.data?.success && (
          <s-banner tone="success">
            Rule created successfully
          </s-banner>
        )}

        {fetcher.data?.error && (
          <s-banner tone="critical">
            {fetcher.data.error}
          </s-banner>
        )}

      </s-section>



      <s-section heading="Existing Rules">

        {rules.length === 0 && (
          <s-paragraph>No rules yet.</s-paragraph>
        )}

        {rules.map(rule => (

          <s-card key={rule.id}>

            <s-stack direction="inline" gap="base">

              <s-text>
                Tag: {rule.tag}
              </s-text>

              <s-badge>
                {rule.discount}% Discount
              </s-badge>

            </s-stack>

          </s-card>

        ))}

      </s-section>

    </s-page>

  );
}