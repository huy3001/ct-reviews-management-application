import { useMemo } from 'react';
import { gql } from '@apollo/client';
import {
  useMcLazyQuery,
  useMcMutation,
  useMcQuery,
} from '@commercetools-frontend/application-shell';
import { GRAPHQL_TARGETS } from '@commercetools-frontend/constants';
import type { ReviewDraft, ReviewRecord, ReviewStatus } from '../types';

// Do not select the variant `id` here: Apollo would normalize every master variant (id: 1)
// into the same cache entry, mixing reviews across products and duplicating rows.
const FETCH_PRODUCT_REVIEWS = gql`
  query FetchProductReviews($limit: Int!, $offset: Int!) {
    products(limit: $limit, offset: $offset) {
      results {
        id
        version
        masterData {
          current {
            masterVariant {
              sku
              attributesRaw {
                name
                value
              }
            }
          }
        }
      }
    }
  }
`;

const FETCH_PRODUCT_BY_SKU = gql`
  query FetchProductBySku($where: String!) {
    products(where: $where, limit: 20) {
      results {
        id
        version
        productType {
          attributeDefinitions(limit: 500) {
            results {
              name
            }
          }
        }
        masterData {
          current {
            masterVariant {
              id
              sku
              attributesRaw {
                name
                value
              }
            }
            variants {
              sku
            }
          }
        }
      }
    }
  }
`;

const UPDATE_PRODUCT_REVIEWS = gql`
  mutation UpdateProductReviews(
    $id: String!
    $version: Long!
    $actions: [ProductUpdateAction!]!
  ) {
    updateProduct(id: $id, version: $version, actions: $actions) {
      id
      version
    }
  }
`;

export class SkuNotFoundError extends Error {
  constructor() {
    super('No Merchant Center product matches this SKU');
    this.name = 'SkuNotFoundError';
  }
}

type StoredReview = {
  id: string;
  sku?: string;
  rating: number;
  author: string;
  title: string;
  content: string;
  createdAt: string;
  status?: ReviewStatus;
  media?: unknown;
};

type ProductReviewSource = {
  id: string;
  version: number;
  masterSku: string;
  reviews: StoredReview[];
};

type ProductReviewQuery = {
  products: {
    results: Array<{
      id: string;
      version: number;
      masterData: {
        current: {
          masterVariant: {
            sku?: string | null;
            attributesRaw: Array<{ name: string; value: unknown }>;
          };
        };
      };
    }>;
  };
};

type ProductBySkuResult = ProductBySkuQuery['products']['results'][number];

type ProductBySkuQuery = {
  products: {
    results: Array<{
      id: string;
      version: number;
      productType: {
        attributeDefinitions: { results: Array<{ name: string }> };
      };
      masterData: {
        current: {
          masterVariant: {
            sku?: string | null;
            attributesRaw: Array<{ name: string; value: unknown }>;
          };
          variants: Array<{ sku?: string | null }>;
        };
      };
    }>;
  };
};

type ProductReviewMutation = {
  updateProduct: { id: string; version: number };
};

function parseReviews(value: unknown): StoredReview[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): StoredReview[] => {
      if (!item || typeof item !== 'object') return [];
      const review = item as Record<string, unknown>;
      const rating = Number(review.rating);
      if (
        typeof review.id !== 'string' ||
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5 ||
        typeof review.author !== 'string' ||
        typeof review.title !== 'string' ||
        typeof review.content !== 'string' ||
        typeof review.createdAt !== 'string'
      ) {
        return [];
      }
      const status = review.status;
      if (
        status !== undefined &&
        status !== 'pending' &&
        status !== 'approved' &&
        status !== 'rejected'
      ) {
        return [];
      }
      return [
        {
          id: review.id,
          ...(typeof review.sku === 'string' && review.sku
            ? { sku: review.sku }
            : {}),
          rating,
          author: review.author,
          title: review.title,
          content: review.content,
          createdAt: review.createdAt,
          status: status as ReviewStatus | undefined,
          ...(review.media === undefined ? {} : { media: review.media }),
        },
      ];
    });
  } catch {
    return [];
  }
}

function toRecord(
  source: ProductReviewSource,
  review: StoredReview
): ReviewRecord {
  return {
    id: review.id,
    productId: source.id,
    sku: review.sku ?? source.masterSku,
    rating: review.rating,
    title: review.title,
    text: review.content,
    reviewDate: review.createdAt,
    reviewerName: review.author,
    status: review.status ?? 'approved',
  };
}

function toStoredReview(draft: ReviewDraft, id: string): StoredReview {
  return {
    id,
    sku: draft.sku,
    rating: draft.rating,
    author: draft.reviewerName,
    title: draft.title,
    content: draft.text,
    createdAt: draft.reviewDate,
    status: draft.status,
  };
}

export const useProductReviews = () => {
  const { data, loading, error, refetch } = useMcQuery<ProductReviewQuery>(
    FETCH_PRODUCT_REVIEWS,
    {
      variables: { limit: 500, offset: 0 },
      context: { target: GRAPHQL_TARGETS.COMMERCETOOLS_PLATFORM },
    }
  );
  const [updateProduct] = useMcMutation<ProductReviewMutation>(
    UPDATE_PRODUCT_REVIEWS
  );

  const [fetchProductBySku] = useMcLazyQuery<ProductBySkuQuery>(
    FETCH_PRODUCT_BY_SKU,
    {
      context: { target: GRAPHQL_TARGETS.COMMERCETOOLS_PLATFORM },
      fetchPolicy: 'network-only',
    }
  );

  const sources = useMemo<ProductReviewSource[]>(() => {
    const values: ProductReviewQuery['products']['results'] =
      data?.products.results ?? [];
    return values.map((product): ProductReviewSource => {
      const masterVariant = product.masterData.current.masterVariant;
      const reviewsValue = masterVariant.attributesRaw.find(
        (attribute) => attribute.name === 'reviews'
      )?.value;
      return {
        id: product.id,
        version: product.version,
        masterSku: masterVariant.sku ?? '',
        reviews: parseReviews(reviewsValue),
      };
    });
  }, [data]);

  const records = useMemo<ReviewRecord[]>(
    () =>
      sources
        .flatMap((source) =>
          source.reviews.map((review) => toRecord(source, review))
        )
        .sort(
          (left, right) =>
            Date.parse(right.reviewDate) - Date.parse(left.reviewDate)
        ),
    [sources]
  );

  const persistReviews = async (
    product: { id: string; version: number },
    reviews: StoredReview[]
  ) => {
    // The attribute is SameForAll, so it must be set on every variant of the current projection
    await updateProduct({
      context: { target: GRAPHQL_TARGETS.COMMERCETOOLS_PLATFORM },
      variables: {
        id: product.id,
        version: product.version,
        actions: [
          {
            setAttributeInAllVariants: {
              name: 'reviews',
              // The GraphQL `value` is a JSON-encoded attribute value; the "reviews" attribute is of
              // type text, so the serialized array must itself be encoded as a JSON string
              value: JSON.stringify(JSON.stringify(reviews)),
              staged: false,
            },
          },
        ],
      },
    });
    await refetch();
  };

  const persist = async (productId: string, reviews: StoredReview[]) => {
    const source = sources.find((item) => item.id === productId);
    if (!source) throw new Error('The selected product could not be found');
    await persistReviews(source, reviews);
  };

  const findProductBySku = async (rawSku: string) => {
    const sku = rawSku.trim();
    if (!sku) throw new SkuNotFoundError();
    const escaped = sku.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const { data: lookup, error: lookupError } = await fetchProductBySku({
      variables: {
        where: `masterData(current(masterVariant(sku="${escaped}") or variants(sku="${escaped}")))`,
      },
    });
    if (lookupError) throw lookupError;
    const product = lookup?.products.results.find(
      ({ masterData }: ProductBySkuResult) =>
        [masterData.current.masterVariant, ...masterData.current.variants].some(
          (variant) => variant.sku === sku
        )
    );
    if (!product) throw new SkuNotFoundError();
    return { product, sku };
  };

  return {
    records,
    loading,
    error,
    create: async (draft: ReviewDraft) => {
      const { product, sku } = await findProductBySku(draft.sku);
      const hasReviewsAttribute =
        product.productType.attributeDefinitions.results.some(
          ({ name }: { name: string }) => name === 'reviews'
        );
      if (!hasReviewsAttribute) {
        throw new Error(
          'The product type of this product has no "reviews" attribute. Add a text attribute named "reviews" to the product type first.'
        );
      }
      const existing = parseReviews(
        product.masterData.current.masterVariant.attributesRaw.find(
          (attribute: { name: string }) => attribute.name === 'reviews'
        )?.value
      );
      await persistReviews(product, [
        ...existing,
        toStoredReview({ ...draft, sku }, crypto.randomUUID()),
      ]);
    },
    update: async (record: ReviewRecord, draft: ReviewDraft) => {
      if (record.sku !== draft.sku) {
        throw new Error('A review cannot be moved to a different product');
      }
      const source = sources.find((item) => item.id === record.productId);
      if (!source) throw new Error('The selected product could not be found');
      await persist(
        record.productId,
        source.reviews.map((review) =>
          review.id === record.id ? toStoredReview(draft, record.id) : review
        )
      );
    },
    setStatus: async (record: ReviewRecord, status: ReviewStatus) => {
      const source = sources.find((item) => item.id === record.productId);
      if (!source) throw new Error('The selected product could not be found');
      await persist(
        record.productId,
        source.reviews.map((review) =>
          review.id === record.id ? { ...review, status } : review
        )
      );
    },
    remove: async (record: ReviewRecord) => {
      const source = sources.find((item) => item.id === record.productId);
      if (!source) throw new Error('The selected product could not be found');
      await persist(
        record.productId,
        source.reviews.filter((review) => review.id !== record.id)
      );
    },
  };
};
