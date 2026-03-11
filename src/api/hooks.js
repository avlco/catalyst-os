import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as entities from './entities';

// Generic hook factory for CRUD operations
function createEntityHooks(entityName, entity) {
  const queryKey = [entityName];

  function useList(filters) {
    return useQuery({
      queryKey: filters ? [...queryKey, filters] : queryKey,
      queryFn: () => entity.list(filters),
    });
  }

  function useGet(id) {
    return useQuery({
      queryKey: [...queryKey, id],
      queryFn: () => entity.get(id),
      enabled: !!id,
    });
  }

  function useCreate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (data) => entity.create(data),
      onSuccess: () => qc.invalidateQueries({ queryKey }),
    });
  }

  function useUpdate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, data }) => entity.update(id, data),
      onSuccess: () => qc.invalidateQueries({ queryKey }),
    });
  }

  function useDelete() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (id) => entity.delete(id),
      onSuccess: () => qc.invalidateQueries({ queryKey }),
    });
  }

  // Soft delete: sets deleted_at instead of hard delete
  function useSoftDelete() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (id) => entity.update(id, { deleted_at: new Date().toISOString() }),
      onSuccess: () => qc.invalidateQueries({ queryKey }),
    });
  }

  return { useList, useGet, useCreate, useUpdate, useDelete, useSoftDelete };
}

// Export hooks for all 18 entities
export const userSettingsHooks = createEntityHooks('UserSettings', entities.UserSettings);
export const personalProjectHooks = createEntityHooks('PersonalProject', entities.PersonalProject);
export const projectSystemHooks = createEntityHooks('ProjectSystem', entities.ProjectSystem);
export const taskHooks = createEntityHooks('Task', entities.Task);
export const sprintHooks = createEntityHooks('Sprint', entities.Sprint);
export const clientHooks = createEntityHooks('Client', entities.Client);
export const interactionHooks = createEntityHooks('Interaction', entities.Interaction);
export const businessProjectHooks = createEntityHooks('BusinessProject', entities.BusinessProject);
export const contentItemHooks = createEntityHooks('ContentItem', entities.ContentItem);
export const rawInputHooks = createEntityHooks('RawInput', entities.RawInput);
export const newsletterHooks = createEntityHooks('Newsletter', entities.Newsletter);
export const githubActivityHooks = createEntityHooks('GitHubActivity', entities.GitHubActivity);
export const notificationHooks = createEntityHooks('Notification', entities.Notification);
export const milestoneHooks = createEntityHooks('Milestone', entities.Milestone);
export const subscriberHooks = createEntityHooks('Subscriber', entities.Subscriber);
export const contentTemplateHooks = createEntityHooks('ContentTemplate', entities.ContentTemplate);
export const documentHooks = createEntityHooks('Document', entities.Document);
export const aiCallLogHooks = createEntityHooks('AICallLog', entities.AICallLog);
export const brandVoiceHooks = createEntityHooks('BrandVoice', entities.BrandVoice);
export const contentPlanHooks = createEntityHooks('ContentPlan', entities.ContentPlan);

// Convenience aliases
export const useProjects = personalProjectHooks.useList;
export const useProject = personalProjectHooks.useGet;
export const useClients = clientHooks.useList;
export const useClient = clientHooks.useGet;
export const useTasks = taskHooks.useList;
export const useTask = taskHooks.useGet;
export const useBusinessProjects = businessProjectHooks.useList;
export const useBusinessProject = businessProjectHooks.useGet;
export const useContentItems = contentItemHooks.useList;
export const useNotifications = notificationHooks.useList;
