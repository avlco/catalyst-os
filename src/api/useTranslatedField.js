import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '@/i18n';
import { backendFunctions } from './backendFunctions';

/**
 * Hook to translate a dynamic field (user content, AI output) to the current UI language.
 * Returns the original text if the current language matches the original language.
 * Uses React Query with staleTime: Infinity to avoid re-fetching the same translation.
 *
 * @param {string} entityType - Entity type (e.g. "Task", "Notification")
 * @param {string} entityId - Entity ID
 * @param {string} field - Field name (e.g. "title", "body")
 * @param {string} originalText - The original text content
 * @param {string} originalLang - Language of the original text (default: 'en')
 * @returns {{ text: string, isTranslating: boolean }}
 */
export function useTranslatedField(entityType, entityId, field, originalText, originalLang = 'en') {
  const { language } = useTranslation();

  const shouldTranslate = language !== originalLang && !!originalText && !!entityId;

  const { data, isLoading } = useQuery({
    queryKey: ['translate', entityType, entityId, field, language, originalText],
    queryFn: () => backendFunctions.translateText({
      text: originalText,
      sourceLang: originalLang,
      targetLang: language,
      entityType,
      entityId,
      field,
    }),
    enabled: shouldTranslate,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60, // 1 hour
    retry: 1,
  });

  return {
    text: shouldTranslate ? (data?.translatedText || originalText) : originalText,
    isTranslating: shouldTranslate && isLoading,
  };
}
