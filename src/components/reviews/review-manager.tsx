import { useMemo, useState } from 'react';
import { useFormik } from 'formik';
import { useShowNotification } from '@commercetools-frontend/actions-global';
import { FormModalPage } from '@commercetools-frontend/application-components';
import { ApplicationPageTitle } from '@commercetools-frontend/application-shell';
import { DOMAINS } from '@commercetools-frontend/constants';
import Constraints from '@commercetools-uikit/constraints';
import DataTable from '@commercetools-uikit/data-table';
import DateField from '@commercetools-uikit/date-field';
import FlatButton from '@commercetools-uikit/flat-button';
import PrimaryButton from '@commercetools-uikit/primary-button';
import SelectField from '@commercetools-uikit/select-field';
import Spacings from '@commercetools-uikit/spacings';
import Text from '@commercetools-uikit/text';
import TextField from '@commercetools-uikit/text-field';
import { ContentNotification } from '@commercetools-uikit/notifications';
import {
  REVIEW_RATINGS,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUSES,
  type ReviewDraft,
  type ReviewRecord,
  type ReviewStatus,
} from '../../types';
import {
  SkuNotFoundError,
  useProductReviews,
} from '../../hooks/use-product-reviews';

const columns = [
  { key: 'reviewerName', label: 'Reviewer' },
  { key: 'sku', label: 'Product SKU' },
  { key: 'rating', label: 'Rating' },
  { key: 'title', label: 'Title' },
  { key: 'reviewDate', label: 'Review date' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Actions' },
];

const statusOptions = [
  { value: '', label: 'All statuses' },
  ...REVIEW_STATUSES.map((status) => ({
    value: status,
    label: REVIEW_STATUS_LABELS[status],
  })),
];

const ratingOptions = REVIEW_RATINGS.map((rating) => ({
  value: String(rating),
  label: String(rating),
}));

const emptyDraft = (): ReviewDraft => ({
  sku: '',
  rating: 5,
  title: '',
  text: '',
  reviewDate: new Date().toISOString(),
  reviewerName: '',
  status: 'approved',
});

const toDateInputValue = (isoDate: string) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
};

// Keep the stored timestamp when the picked day is unchanged so same-day reviews keep their order
const fromDateInputValue = (day: string, previousIso: string) => {
  if (day === toDateInputValue(previousIso)) return previousIso;
  const [year, month, date] = day.split('-').map(Number);
  const now = new Date();
  return new Date(
    year,
    month - 1,
    date,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds()
  ).toISOString();
};

type SaveResult = { field: 'sku' } | { message: string } | undefined;

const ReviewEditor = ({
  review,
  onClose,
  onSave,
}: {
  review?: ReviewRecord;
  onClose: () => void;
  onSave: (draft: ReviewDraft) => Promise<SaveResult>;
}) => {
  const [saveError, setSaveError] = useState<string | null>(null);
  // Must be referentially/deeply stable: emptyDraft() embeds a new timestamp on every call,
  // which would make enableReinitialize reset the form on every render
  const initialValues = useMemo<ReviewDraft>(
    () => (review ? { ...review } : emptyDraft()),
    [review]
  );
  const formik = useFormik<ReviewDraft>({
    initialValues,
    enableReinitialize: true,
    validate: (values) => {
      const errors: Partial<Record<keyof ReviewDraft, string>> = {};
      if (!values.sku.trim()) errors.sku = 'Product SKU is required';
      if (
        !Number.isInteger(values.rating) ||
        values.rating < 1 ||
        values.rating > 5
      ) {
        errors.rating = 'Rating must be an integer from 1 to 5';
      }
      if (!values.title.trim()) errors.title = 'Review title is required';
      if (!values.text.trim()) errors.text = 'Review text is required';
      if (!values.reviewerName.trim()) {
        errors.reviewerName = 'Reviewer name is required';
      }
      if (!values.reviewDate || Number.isNaN(Date.parse(values.reviewDate))) {
        errors.reviewDate = 'A valid review date is required';
      }
      return errors;
    },
    onSubmit: async (values) => {
      setSaveError(null);
      const result = await onSave({
        ...values,
        sku: values.sku.trim(),
        title: values.title.trim(),
        text: values.text.trim(),
        reviewerName: values.reviewerName.trim(),
        reviewDate: new Date(values.reviewDate).toISOString(),
      });
      if (result && 'field' in result) {
        formik.setFieldError(
          'sku',
          'No Merchant Center product matches this SKU'
        );
      } else if (result) {
        setSaveError(result.message);
      }
    },
  });

  return (
    <FormModalPage
      title={review ? 'Edit review' : 'Create review'}
      isOpen
      onClose={onClose}
      onPrimaryButtonClick={formik.submitForm}
      onSecondaryButtonClick={onClose}
      isPrimaryButtonDisabled={!formik.isValid || formik.isSubmitting}
      labelPrimaryButton={review ? 'Save review' : 'Create review'}
      labelSecondaryButton="Cancel"
    >
      <Spacings.Stack scale="l">
        {saveError && (
          <ContentNotification type="error">
            <Text.Body>{saveError}</Text.Body>
          </ContentNotification>
        )}
        <TextField
          name="sku"
          title="Product SKU"
          value={formik.values.sku}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          errors={TextField.toFieldErrors<ReviewDraft>(formik.errors).sku}
          touched={formik.touched.sku}
          isDisabled={Boolean(review)}
          isRequired
        />
        <TextField
          name="reviewerName"
          title="Reviewer name"
          value={formik.values.reviewerName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          errors={
            TextField.toFieldErrors<ReviewDraft>(formik.errors).reviewerName
          }
          touched={formik.touched.reviewerName}
          isRequired
        />
        <SelectField
          name="rating"
          title="Rating (1-5)"
          value={String(formik.values.rating)}
          options={ratingOptions}
          onChange={(event) =>
            formik.setFieldValue('rating', Number(event.target.value))
          }
          onBlur={formik.handleBlur}
          errors={SelectField.toFieldErrors<ReviewDraft>(formik.errors).rating}
          touched={formik.touched.rating}
          isRequired
        />
        <TextField
          name="title"
          title="Review title"
          value={formik.values.title}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          errors={TextField.toFieldErrors<ReviewDraft>(formik.errors).title}
          touched={formik.touched.title}
          isRequired
        />
        <TextField
          name="text"
          title="Review text"
          value={formik.values.text}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          errors={TextField.toFieldErrors<ReviewDraft>(formik.errors).text}
          touched={formik.touched.text}
          isRequired
        />
        <DateField
          name="reviewDate"
          title="Review date"
          value={toDateInputValue(formik.values.reviewDate)}
          onChange={(event) =>
            formik.setFieldValue(
              'reviewDate',
              event.target.value
                ? fromDateInputValue(
                    event.target.value,
                    formik.values.reviewDate
                  )
                : ''
            )
          }
          onBlur={formik.handleBlur}
          errors={
            DateField.toFieldErrors<ReviewDraft>(formik.errors).reviewDate
          }
          touched={Boolean(formik.touched.reviewDate)}
          isRequired
        />
        <SelectField
          name="status"
          title="Status"
          value={formik.values.status}
          options={statusOptions.slice(1)}
          onChange={(event) =>
            formik.setFieldValue('status', event.target.value)
          }
          isRequired
        />
      </Spacings.Stack>
    </FormModalPage>
  );
};

const ReviewManager = () => {
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | undefined>();
  const [editingReview, setEditingReview] = useState<
    ReviewRecord | null | undefined
  >(undefined);
  const showNotification = useShowNotification();
  const [operationError, setOperationError] = useState<string | null>(null);
  const {
    records,
    loading: isLoading,
    error,
    create,
    update,
    setStatus,
    remove,
  } = useProductReviews();

  const reviews = useMemo(
    () =>
      records.filter(
        (review) => !statusFilter || review.status === statusFilter
      ),
    [records, statusFilter]
  );

  const saveReview = async (draft: ReviewDraft): Promise<SaveResult> => {
    setOperationError(null);
    try {
      if (editingReview) {
        await update(editingReview, draft);
      } else {
        await create(draft);
      }
      setEditingReview(undefined);
      showNotification({
        kind: 'success',
        domain: DOMAINS.SIDE,
        text: editingReview ? 'Review saved' : 'Review created',
      });
    } catch (saveError) {
      if (saveError instanceof SkuNotFoundError) return { field: 'sku' };
      return {
        message:
          saveError instanceof Error
            ? saveError.message
            : 'Unable to save review',
      };
    }
    return undefined;
  };

  const changeStatus = async (review: ReviewRecord, status: ReviewStatus) => {
    setOperationError(null);
    try {
      await setStatus(review, status);
    } catch (statusError) {
      setOperationError(
        statusError instanceof Error
          ? statusError.message
          : 'Unable to update review status'
      );
    }
  };

  const deleteReview = async (review: ReviewRecord) => {
    if (!window.confirm('Delete this review permanently?')) return;
    setOperationError(null);
    try {
      await remove(review);
    } catch (deleteError) {
      setOperationError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Unable to delete review'
      );
    }
  };

  return (
    <>
      <ApplicationPageTitle additionalParts={['Reviews']} />
      <Spacings.Stack scale="xl">
        <Spacings.Inline alignItems="center" justifyContent="space-between">
          <Spacings.Stack scale="xs">
            <Text.Headline as="h1">Reviews</Text.Headline>
            <Text.Body>
              Manage product reviews before they are published.
            </Text.Body>
          </Spacings.Stack>
          <PrimaryButton
            label="Create review"
            onClick={() => setEditingReview(null)}
          />
        </Spacings.Inline>
        <Constraints.Horizontal max={13}>
          <SelectField
            name="status-filter"
            title="Filter by status"
            value={statusFilter ?? ''}
            options={statusOptions}
            onChange={(event) =>
              setStatusFilter(
                (event.target.value || undefined) as ReviewStatus | undefined
              )
            }
            horizontalConstraint={5}
          />
        </Constraints.Horizontal>
        {error && (
          <ContentNotification type="error">
            <Text.Body>
              Unable to load product reviews. Please refresh and try again.
            </Text.Body>
          </ContentNotification>
        )}
        {operationError && (
          <ContentNotification type="error">
            <Text.Body>{operationError}</Text.Body>
          </ContentNotification>
        )}
        {isLoading ? (
          <Text.Body>Loading reviews…</Text.Body>
        ) : (
          <DataTable<ReviewRecord>
            isCondensed
            columns={columns}
            rows={reviews}
            itemRenderer={(review, column) => {
              switch (column.key) {
                case 'reviewerName':
                case 'sku':
                case 'title':
                  return review[column.key];
                case 'status':
                  return REVIEW_STATUS_LABELS[review.status];
                case 'rating':
                  return `${review.rating} / 5`;
                case 'reviewDate':
                  return new Date(review.reviewDate).toLocaleDateString();
                case 'actions':
                  return (
                    <Spacings.Inline scale="s">
                      <FlatButton
                        label="Edit"
                        onClick={() => setEditingReview(review)}
                      />
                      {review.status !== 'approved' && (
                        <FlatButton
                          label="Approve"
                          onClick={() => void changeStatus(review, 'approved')}
                        />
                      )}
                      {review.status !== 'rejected' && (
                        <FlatButton
                          label="Reject"
                          onClick={() => void changeStatus(review, 'rejected')}
                        />
                      )}
                      <FlatButton
                        label="Delete"
                        onClick={() => void deleteReview(review)}
                      />
                    </Spacings.Inline>
                  );
                default:
                  return null;
              }
            }}
          />
        )}
      </Spacings.Stack>
      {editingReview !== undefined && (
        <ReviewEditor
          review={editingReview ?? undefined}
          onClose={() => setEditingReview(undefined)}
          onSave={saveReview}
        />
      )}
    </>
  );
};

ReviewManager.displayName = 'ReviewManager';

export default ReviewManager;
