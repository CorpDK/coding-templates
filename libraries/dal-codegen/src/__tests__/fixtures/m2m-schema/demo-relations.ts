import { relations } from "drizzle-orm";
import { demoTags } from "./demo-tags.js";
import { demoUserTags } from "./demo-user-tags.js";
import { demoUsers } from "./demo-users.js";

export const demoUsersRelations = relations(demoUsers, ({ many }) => ({
  tags: many(demoUserTags),
}));

export const demoTagsRelations = relations(demoTags, ({ many }) => ({
  users: many(demoUserTags),
}));

export const demoUserTagsRelations = relations(demoUserTags, ({ one }) => ({
  user: one(demoUsers, {
    fields: [demoUserTags.demoUserId],
    references: [demoUsers.id],
  }),
  tag: one(demoTags, {
    fields: [demoUserTags.demoTagId],
    references: [demoTags.id],
  }),
}));
