# Reviews Management Application

Merchant Center custom application for managing product reviews. Reviews are stored in a `reviews` text attribute on commercetools products, where they can be created, edited, approved, rejected, and deleted.

## Setup

1. Add a `reviews` attribute to each Product Type whose products will have reviews. The application does not create this attribute automatically. Use a text attribute with the `SameForAll` constraint so the value can be shared across product variants:

   ```json
   {
     "name": "reviews",
     "label": { "en": "Reviews" },
     "required": false,
     "type": { "name": "text" },
     "attributeConstraint": "SameForAll",
     "inputHint": "MultiLine"
   }
   ```

2. The application requests the `view_products` and `manage_products` OAuth scopes in `custom-application-config.mjs`. For local development, set `initialProjectKey` there to the Project you want to use. Before a production build, configure the production `applicationId` and `url` for the registered application and its deployed URL.

3. Install dependencies and start the application:

   ```sh
   npm install
   npm start
   ```

## Structure

- `src/components/reviews/review-manager.tsx` – review table, status filter, create/edit form, and approve, reject, and delete actions.
- `src/hooks/use-product-reviews.ts` – commercetools GraphQL queries and mutations; finds products by master or variant SKU and reads/writes the `reviews` attribute.
- `src/types.ts` – review record, draft, rating, and status types.
- `src/routes.tsx` – application route that renders the review manager.
- `custom-application-config.mjs` – Merchant Center application identity, development Project, production URL, and requested OAuth scopes.

## Notes

- The review list loads the first 500 products and collects their reviews client-side. Products without a `reviews` value have no reviews to manage.
- The attribute value is a JSON-encoded array of review records. Saving writes it across all variants, so the attribute must use the `SameForAll` constraint.
- New reviews match a product by master or variant SKU. A review's SKU cannot be changed when editing it.
- Reviews support ratings from 1 to 5 and the `pending`, `approved`, and `rejected` statuses. Older records without a status are treated as approved.
