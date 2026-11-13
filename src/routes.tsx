import Spacings from '@commercetools-uikit/spacings';
import ReviewManager from './components/reviews/review-manager';

const ApplicationRoutes = () => (
  <Spacings.Inset scale="l">
    <ReviewManager />
  </Spacings.Inset>
);
ApplicationRoutes.displayName = 'ApplicationRoutes';

export default ApplicationRoutes;
