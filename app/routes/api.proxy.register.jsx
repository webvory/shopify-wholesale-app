import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return { error: "Method not allowed" };
  }

  try {
    const { session } = await authenticate.public.appProxy(request);
    
    if (!session) {
      return { error: "Unauthorized request" };
    }

    const formData = await request.formData();
    
    const businessName = formData.get("businessName");
    const contactName = formData.get("contactName");
    const email = formData.get("email");
    const phone = formData.get("phone");
    const website = formData.get("website");
    const businessType = formData.get("businessType");
    const taxId = formData.get("taxId");
    const billingAddress = formData.get("billingAddress");
    const shippingAddress = formData.get("shippingAddress");

   
    
    if (!businessName || !contactName || !email || !phone || !businessType) {
      return { error: "Please fill in all required fields." };
    }

    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone)) {
      return { error: "Invalid phone number format. Must include country code (e.g., +1234567890)." };
    }

    const application = await prisma.wholesaleApplication.create({
      data: {
        shop: session.shop,
        businessName,
        contactName,
        email,
        phone,
        website,
        businessType,
        taxId,
        billingAddress,
        shippingAddress,
        status: "Pending"
      }
    });

    return { success: true, application };
    
  } catch (error) {
    console.error("Error processing wholesale registration:", error);
    return { error: "An unexpected error occurred." };
  }
};
