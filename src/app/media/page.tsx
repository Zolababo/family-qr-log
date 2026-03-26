import { Suspense } from 'react';
import MediaViewerClient from './MediaViewerClient';

export default function MediaPage() {
  return (
    <Suspense fallback={null}>
      <MediaViewerClient />
    </Suspense>
  );
}
