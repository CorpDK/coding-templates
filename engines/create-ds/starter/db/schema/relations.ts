import { relations } from "drizzle-orm";
import { tags } from "./tags.js";

export const tagsRelations = relations(tags, () => ({}));
