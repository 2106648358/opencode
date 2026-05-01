import { Schema } from "effect"
import { zod } from "@/util/effect-zod"
import { withStatics } from "@/util/schema"

export const RepoRef = Schema.Struct({
  url: Schema.String,
  ref: Schema.optional(Schema.String),
}).pipe(withStatics((s) => ({ zod: zod(s) })))

export const Info = Schema.Struct({
  repos: Schema.optional(Schema.Array(RepoRef)).annotate({
    description: "Template git repositories to sync",
  }),
}).pipe(withStatics((s) => ({ zod: zod(s) })))

export type Info = Schema.Schema.Type<typeof Info>
export type RepoRef = Schema.Schema.Type<typeof RepoRef>

export * as ConfigTemplate from "./template"
