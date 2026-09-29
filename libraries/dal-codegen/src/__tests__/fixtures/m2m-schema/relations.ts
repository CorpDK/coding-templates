import { relations } from "drizzle-orm";
import { labels } from "./labels.js";
import { userLabels } from "./user-labels.js";
import { users } from "./users.js";

export const usersRelations = relations(users, ({ many }) => ({
  labels: many(userLabels),
}));

export const labelsRelations = relations(labels, ({ many }) => ({
  users: many(userLabels),
}));

export const userLabelsRelations = relations(userLabels, ({ one }) => ({
  user: one(users, {
    fields: [userLabels.userId],
    references: [users.id],
  }),
  label: one(labels, {
    fields: [userLabels.labelId],
    references: [labels.id],
  }),
}));
