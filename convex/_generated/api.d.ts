/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as emailLogs from "../emailLogs.js";
import type * as emailTemplates from "../emailTemplates.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_billing from "../lib/billing.js";
import type * as lib_emailProvider from "../lib/emailProvider.js";
import type * as lib_requestEmailDelivery from "../lib/requestEmailDelivery.js";
import type * as lib_requestEmailTemplates from "../lib/requestEmailTemplates.js";
import type * as lib_resendDomains from "../lib/resendDomains.js";
import type * as lib_verificationEmail from "../lib/verificationEmail.js";
import type * as requestEmails from "../requestEmails.js";
import type * as requestEvents from "../requestEvents.js";
import type * as requestNotes from "../requestNotes.js";
import type * as requests from "../requests.js";
import type * as validators from "../validators.js";
import type * as verification from "../verification.js";
import type * as verificationDelivery from "../verificationDelivery.js";
import type * as workspaceSenders from "../workspaceSenders.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  emailLogs: typeof emailLogs;
  emailTemplates: typeof emailTemplates;
  "lib/access": typeof lib_access;
  "lib/billing": typeof lib_billing;
  "lib/emailProvider": typeof lib_emailProvider;
  "lib/requestEmailDelivery": typeof lib_requestEmailDelivery;
  "lib/requestEmailTemplates": typeof lib_requestEmailTemplates;
  "lib/resendDomains": typeof lib_resendDomains;
  "lib/verificationEmail": typeof lib_verificationEmail;
  requestEmails: typeof requestEmails;
  requestEvents: typeof requestEvents;
  requestNotes: typeof requestNotes;
  requests: typeof requests;
  validators: typeof validators;
  verification: typeof verification;
  verificationDelivery: typeof verificationDelivery;
  workspaceSenders: typeof workspaceSenders;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
