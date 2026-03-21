import { Suspense } from 'react';
import WriteLogClient from './WriteLogClient';

export default function WritePage() {
  return (
    <Suspense fallback={null}>
      <WriteLogClient />
    </Suspense>
  );
}
