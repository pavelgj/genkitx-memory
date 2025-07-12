import { z } from 'genkit';

// We are storing our memory using entities, relations, and observations in a graph structure
export const EntitySchema = z.object({
  name: z.string(),
  entityType: z.string(),
  observations: z.array(z.string()),
});
export type Entity = z.infer<typeof EntitySchema>;

export const RelationshipSchema = z.object({
  from: z.string(),
  to: z.string(),
  relationshipType: z.string(),
});
export type Relationship = z.infer<typeof RelationshipSchema>;

export const KnowledgeGraphSchema = z.object({
  entities: z.array(EntitySchema),
  relationships: z.array(RelationshipSchema),
});
export type KnowledgeGraph = z.infer<typeof KnowledgeGraphSchema>;

export const ObservationSchema = z.object({
  entityName: z.string(),
  contents: z.array(z.string()),
});
export type Observation = z.infer<typeof ObservationSchema>;

export interface AddedObservationResult {
  entityName: string;
  addedObservations: string[];
}

export interface DeletedObservation {
  entityName: string;
  observations: string[];
}
