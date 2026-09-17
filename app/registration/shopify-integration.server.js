import { buildMappings } from "./mapping.js";
import { gid, validEmail } from "./common.server.js";

export async function graphql(admin, query, variables, mutation) {
  let response;
  try {
    response = await admin.graphql(query, {
      variables,
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error(
      "Shopify could not confirm the request. Check store permissions and connection, then retry. If a record was created, link its ID before retrying.",
    );
  }
  const body = await response.json();
  if (body.errors?.length)
    throw new Error(body.errors.map((error) => error.message).join(" "));
  const result = mutation ? body.data?.[mutation] : body.data;
  if (!result) throw new Error("Shopify returned an empty response.");
  if (result.userErrors?.length) {
    const error = new Error(
      result.userErrors.map((item) => item.message).join(" "),
    );
    error.confirmedFailure = true;
    throw error;
  }
  return result;
}
export async function integrateApplication(
  admin,
  application,
  options,
  persist,
) {
  const mapping = buildMappings(
    application.configurationSnapshot,
    application.submittedData,
  );
  const approval = {
    ...application.settingsSnapshot.approval,
    ...Object.fromEntries(Object.entries(options).filter(([, value]) => value)),
  };
  const state = { ...(application.integrationState || {}) };
  const ids = {
    customerId: gid(options.customerId || application.customerId, "Customer"),
    companyId: gid(options.companyId || application.companyId, "Company"),
    companyLocationId: gid(
      options.companyLocationId || application.companyLocationId,
      "CompanyLocation",
    ),
    companyContactId: application.companyContactId,
  };
  for (const [key, type] of [
    ["customerId", "Customer"],
    ["companyId", "Company"],
    ["companyLocationId", "CompanyLocation"],
  ]) {
    if (
      application[key] &&
      options[key] &&
      gid(options[key], type) !== application[key]
    )
      throw new Error(
        `The confirmed ${type} cannot be changed during a retry. Use its existing ID.`,
      );
  }
  const save = async () => persist({ ...ids, integrationState: state });
  const email = mapping.customer.email || application.email;
  if (!validEmail(email))
    throw new Error(
      "A valid applicant email is required to create or link a Shopify customer.",
    );
  if (
    approval.mode !== "b2b" &&
    (mapping.companyMetafields.length || mapping.locationMetafields.length)
  )
    throw new Error(
      "Company mappings require the Shopify B2B approval workflow.",
    );
  // Resolve and verify IDs using this shop's authenticated Admin API only.
  if (ids.customerId) {
    const result = await graphql(
      admin,
      `
        query RegistrationCustomer($id: ID!) {
          customer(id: $id) {
            id
            email
          }
        }
      `,
      { id: ids.customerId },
    );
    if (!result.customer)
      throw new Error("Customer does not exist in this store.");
  } else {
    const result = await graphql(
      admin,
      `
        query RegistrationCustomerSearch($query: String!) {
          customers(first: 10, query: $query) {
            nodes {
              id
              email
            }
          }
        }
      `,
      { query: `email:${JSON.stringify(email)}` },
    );
    ids.customerId = result.customers.nodes.find(
      (item) => item.email?.toLowerCase() === email.toLowerCase(),
    )?.id;
  }
  if (!ids.customerId) {
    if (state.customerCreationUnconfirmed)
      throw new Error(
        "A previous customer creation was not confirmed. Find the customer in Shopify and enter its ID before retrying.",
      );
    state.customerCreationUnconfirmed = true;
    await save();
    try {
      const result = await graphql(
        admin,
        `
          mutation RegistrationCustomerCreate($input: CustomerInput!) {
            customerCreate(input: $input) {
              customer {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        { input: { ...mapping.customer, email } },
        "customerCreate",
      );
      ids.customerId = result.customer.id;
      state.customerCreationUnconfirmed = false;
      await save();
    } catch (error) {
      if (error.confirmedFailure) {
        state.customerCreationUnconfirmed = false;
        await save();
      }
      throw error;
    }
  } else {
    state.customerCreationUnconfirmed = false;
    await save();
  }
  if (Object.keys(mapping.customer).length)
    await graphql(
      admin,
      `
        mutation RegistrationCustomerUpdate($input: CustomerInput!) {
          customerUpdate(input: $input) {
            customer {
              id
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      { input: { id: ids.customerId, ...mapping.customer } },
      "customerUpdate",
    );

  if (approval.mode === "b2b") {
    // Querying companies also verifies the store's B2B capability before creating records.
    if (!application.companyName && !ids.companyId)
      throw new Error("Company name is required for B2B approval.");
    if (ids.companyId) {
      const result = await graphql(
        admin,
        `
          query RegistrationCompany($id: ID!) {
            company(id: $id) {
              id
              defaultRole {
                id
              }
            }
          }
        `,
        { id: ids.companyId },
      );
      if (!result.company)
        throw new Error("Company does not exist in this store.");
      state.roleId = result.company.defaultRole?.id;
      state.companyCreationUnconfirmed = false;
    } else {
      await graphql(
        admin,
        `
          query RegistrationB2BAccess {
            companies(first: 1) {
              nodes {
                id
              }
            }
          }
        `,
        {},
      );
      if (state.companyCreationUnconfirmed)
        throw new Error(
          "Previous company creation was not confirmed. Find the company in Shopify and enter its ID before retrying.",
        );
      state.companyCreationUnconfirmed = true;
      await save();
      try {
        const result = await graphql(
          admin,
          `
            mutation RegistrationCompanyCreate($input: CompanyCreateInput!) {
              companyCreate(input: $input) {
                company {
                  id
                  defaultRole {
                    id
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          {
            input: {
              company: {
                name: application.companyName,
                externalId: application.id,
              },
            },
          },
          "companyCreate",
        );
        ids.companyId = result.company.id;
        state.roleId = result.company.defaultRole?.id;
        state.companyCreationUnconfirmed = false;
        await save();
      } catch (error) {
        if (error.confirmedFailure) {
          state.companyCreationUnconfirmed = false;
          await save();
        }
        throw error;
      }
    }
    if (ids.companyLocationId) {
      const result = await graphql(
        admin,
        `
          query RegistrationLocation($id: ID!) {
            companyLocation(id: $id) {
              id
              company {
                id
              }
            }
          }
        `,
        { id: ids.companyLocationId },
      );
      if (result.companyLocation?.company.id !== ids.companyId)
        throw new Error(
          "Company location does not belong to the selected company in this store.",
        );
      state.locationCreationUnconfirmed = false;
    } else {
      if (state.locationCreationUnconfirmed)
        throw new Error(
          "Previous location creation was not confirmed. Find the location in Shopify and enter its ID before retrying.",
        );
      state.locationCreationUnconfirmed = true;
      await save();
      try {
        const address = { ...mapping.address };
        if (address.province) {
          address.zoneCode = address.province;
          delete address.province;
        }
        const input = {
          name: application.companyName || "Primary location",
          ...(Object.keys(address).length
            ? { shippingAddress: address, billingSameAsShipping: true }
            : {}),
        };
        const result = await graphql(
          admin,
          `
            mutation RegistrationLocationCreate(
              $companyId: ID!
              $input: CompanyLocationInput!
            ) {
              companyLocationCreate(companyId: $companyId, input: $input) {
                companyLocation {
                  id
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          { companyId: ids.companyId, input },
          "companyLocationCreate",
        );
        ids.companyLocationId = result.companyLocation.id;
        state.locationCreationUnconfirmed = false;
        state.addressApplied = true;
        await save();
      } catch (error) {
        if (error.confirmedFailure) {
          state.locationCreationUnconfirmed = false;
          await save();
        }
        throw error;
      }
    }
    if (Object.keys(mapping.address).length && !state.addressApplied) {
      const address = { ...mapping.address };
      if (address.province) {
        address.zoneCode = address.province;
        delete address.province;
      }
      await graphql(
        admin,
        `
          mutation RegistrationLocationAddress(
            $locationId: ID!
            $address: CompanyAddressInput!
          ) {
            companyLocationAssignAddress(
              locationId: $locationId
              address: $address
              addressTypes: [SHIPPING, BILLING]
            ) {
              userErrors {
                field
                message
              }
            }
          }
        `,
        { locationId: ids.companyLocationId, address },
        "companyLocationAssignAddress",
      );
      state.addressApplied = true;
      await save();
    }
    // Paginate contacts to avoid creating a second association on retries.
    if (!ids.companyContactId) {
      let cursor = null;
      do {
        const result = await graphql(
          admin,
          `
            query RegistrationContacts($id: ID!, $after: String) {
              company(id: $id) {
                contacts(first: 100, after: $after) {
                  nodes {
                    id
                    customer {
                      id
                    }
                  }
                  pageInfo {
                    hasNextPage
                    endCursor
                  }
                }
              }
            }
          `,
          { id: ids.companyId, after: cursor },
        );
        const contacts = result.company.contacts;
        ids.companyContactId = contacts.nodes.find(
          (contact) => contact.customer.id === ids.customerId,
        )?.id;
        cursor = contacts.pageInfo.hasNextPage
          ? contacts.pageInfo.endCursor
          : null;
      } while (cursor && !ids.companyContactId);
      if (!ids.companyContactId) {
        const result = await graphql(
          admin,
          `
            mutation RegistrationCompanyContact(
              $companyId: ID!
              $customerId: ID!
            ) {
              companyAssignCustomerAsContact(
                companyId: $companyId
                customerId: $customerId
              ) {
                companyContact {
                  id
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          { companyId: ids.companyId, customerId: ids.customerId },
          "companyAssignCustomerAsContact",
        );
        ids.companyContactId = result.companyContact.id;
      }
      await save();
    }
    if (!state.roleAssigned) {
      if (!state.roleId)
        throw new Error(
          "This company has no default contact role. Assign a role in Shopify before retrying.",
        );
      let cursor = null,
        assigned = false;
      do {
        const result = await graphql(
          admin,
          `
            query RegistrationExistingRoles($id: ID!, $after: String) {
              companyContact(id: $id) {
                company {
                  id
                }
                customer {
                  id
                }
                roleAssignments(first: 100, after: $after) {
                  nodes {
                    companyLocation {
                      id
                    }
                    role {
                      id
                    }
                  }
                  pageInfo {
                    hasNextPage
                    endCursor
                  }
                }
              }
            }
          `,
          { id: ids.companyContactId, after: cursor },
        );
        if (
          result.companyContact?.company.id !== ids.companyId ||
          result.companyContact.customer.id !== ids.customerId
        )
          throw new Error("Company contact does not match this application.");
        const roles = result.companyContact.roleAssignments;
        assigned = roles.nodes.some(
          (item) =>
            item.companyLocation.id === ids.companyLocationId &&
            item.role.id === state.roleId,
        );
        cursor = roles.pageInfo.hasNextPage ? roles.pageInfo.endCursor : null;
      } while (cursor && !assigned);
      if (!assigned)
        await graphql(
          admin,
          `
            mutation RegistrationContactRole(
              $companyContactId: ID!
              $companyContactRoleId: ID!
              $companyLocationId: ID!
            ) {
              companyContactAssignRole(
                companyContactId: $companyContactId
                companyContactRoleId: $companyContactRoleId
                companyLocationId: $companyLocationId
              ) {
                companyContactRoleAssignment {
                  id
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          {
            companyContactId: ids.companyContactId,
            companyContactRoleId: state.roleId,
            companyLocationId: ids.companyLocationId,
          },
          "companyContactAssignRole",
        );
      state.roleAssigned = true;
      await save();
    }
    const catalogId = gid(approval.catalogId, "CompanyLocationCatalog");
    if (catalogId && state.catalogId !== catalogId) {
      await graphql(
        admin,
        `
          mutation RegistrationCatalog(
            $catalogId: ID!
            $contexts: CatalogContextInput!
          ) {
            catalogContextUpdate(
              catalogId: $catalogId
              contextsToAdd: $contexts
            ) {
              catalog {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        {
          catalogId,
          contexts: { companyLocationIds: [ids.companyLocationId] },
        },
        "catalogContextUpdate",
      );
      state.catalogId = catalogId;
      await save();
    }
    const paymentTermsTemplateId = gid(
      approval.paymentTermsTemplateId,
      "PaymentTermsTemplate",
    );
    if (
      paymentTermsTemplateId &&
      state.paymentTermsTemplateId !== paymentTermsTemplateId
    ) {
      await graphql(
        admin,
        `
          mutation RegistrationTerms(
            $companyLocationId: ID!
            $input: CompanyLocationUpdateInput!
          ) {
            companyLocationUpdate(
              companyLocationId: $companyLocationId
              input: $input
            ) {
              companyLocation {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        {
          companyLocationId: ids.companyLocationId,
          input: { buyerExperienceConfiguration: { paymentTermsTemplateId } },
        },
        "companyLocationUpdate",
      );
      state.paymentTermsTemplateId = paymentTermsTemplateId;
      await save();
    }
  } else if (Object.keys(mapping.address).length && !state.addressApplied) {
    let cursor = null,
      existingAddress = false;
    do {
      const result = await graphql(
        admin,
        `
          query RegistrationExistingAddresses($id: ID!, $after: String) {
            customer(id: $id) {
              addressesV2(first: 100, after: $after) {
                nodes {
                  id
                  address1
                  address2
                  city
                  province
                  zip
                  countryCodeV2
                }
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          }
        `,
        { id: ids.customerId, after: cursor },
      );
      const addresses = result.customer.addressesV2;
      existingAddress = addresses.nodes.some((address) =>
        Object.entries(mapping.address).every(
          ([key, value]) =>
            String(address[key === "countryCode" ? "countryCodeV2" : key] || "")
              .trim()
              .toLowerCase() === String(value).trim().toLowerCase(),
        ),
      );
      cursor = addresses.pageInfo.hasNextPage
        ? addresses.pageInfo.endCursor
        : null;
    } while (cursor && !existingAddress);
    if (!existingAddress && state.addressCreationUnconfirmed)
      throw new Error(
        "A previous address creation was not confirmed. Reconcile the address in Shopify with the submitted address before retrying.",
      );
    if (!existingAddress) {
      state.addressCreationUnconfirmed = true;
      await save();
      try {
        await graphql(
          admin,
          `
            mutation RegistrationCustomerAddress(
              $customerId: ID!
              $address: MailingAddressInput!
            ) {
              customerAddressCreate(
                customerId: $customerId
                address: $address
              ) {
                customerAddress {
                  id
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          { customerId: ids.customerId, address: mapping.address },
          "customerAddressCreate",
        );
      } catch (error) {
        if (error.confirmedFailure) {
          state.addressCreationUnconfirmed = false;
          await save();
        }
        throw error;
      }
    }
    state.addressApplied = true;
    state.addressCreationUnconfirmed = false;
    await save();
  }
  const metafields = [
    ...mapping.customerMetafields.map((item) => ({
      ...item,
      ownerId: ids.customerId,
    })),
    ...mapping.companyMetafields.map((item) => ({
      ...item,
      ownerId: ids.companyId,
    })),
    ...mapping.locationMetafields.map((item) => ({
      ...item,
      ownerId: ids.companyLocationId,
    })),
  ];
  for (let index = 0; index < metafields.length; index += 25)
    await graphql(
      admin,
      `
        mutation RegistrationMetafields($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              id
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      { metafields: metafields.slice(index, index + 25) },
      "metafieldsSet",
    );
  const tags = [
    ...new Set([...mapping.tags, approval.customerTag].filter(Boolean)),
  ];
  if (tags.length)
    await graphql(
      admin,
      `
        mutation RegistrationTags($id: ID!, $tags: [String!]!) {
          tagsAdd(id: $id, tags: $tags) {
            userErrors {
              field
              message
            }
          }
        }
      `,
      { id: ids.customerId, tags },
      "tagsAdd",
    );
  await save();
  return ids;
}
