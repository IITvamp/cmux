import React from 'react';
import { PreviewCommentsWidget } from './PreviewCommentsWidget';

export interface PreviewCommentsConfig {
  apiUrl?: string;
  userId?: string;
  userName?: string;
}

export function PreviewComments(config?: PreviewCommentsConfig) {
  return <PreviewCommentsWidget {...config} />;
}

export default PreviewComments;