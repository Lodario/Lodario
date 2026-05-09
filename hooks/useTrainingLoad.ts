import { useMemo } from 'react';
import { useData } from '../lib/DataContext';
import { analyzeTrainingLoad, LoadResult } from '../lib/training-load';

export function useTrainingLoad(): LoadResult {
  const { trainingLogs, wellnessLogs } = useData();

  return useMemo(() => {
    return analyzeTrainingLoad(trainingLogs, Object.values(wellnessLogs));
  }, [trainingLogs, wellnessLogs]);
}
