import { v } from 'convex/values'

export const nullableStringValidator = v.union(v.string(), v.null())
export const nullableNumberValidator = v.union(v.number(), v.null())

export const requestStatusValidator = v.union(
  v.literal('received'),
  v.literal('in_progress'),
  v.literal('waiting_on_requester'),
  v.literal('completed'),
  v.literal('rejected'),
  v.literal('cancelled')
)

export const activeRequestStatusValidator = v.union(
  v.literal('received'),
  v.literal('in_progress'),
  v.literal('waiting_on_requester')
)

export const closedRequestStatusValidator = v.union(
  v.literal('completed'),
  v.literal('rejected'),
  v.literal('cancelled')
)

export const verificationStatusValidator = v.union(
  v.literal('not_required'),
  v.literal('pending'),
  v.literal('verified'),
  v.literal('expired'),
  v.literal('failed')
)

export const requestTypeValidator = v.union(
  v.literal('access'),
  v.literal('deletion'),
  v.literal('correction'),
  v.literal('portability'),
  v.literal('objection'),
  v.literal('restriction')
)

export const memberRoleValidator = v.union(
  v.literal('owner'),
  v.literal('admin'),
  v.literal('member')
)

export const workspacePlanValidator = v.union(
  v.literal('starter'),
  v.literal('pro'),
  v.literal('team')
)

export const emailProviderValidator = v.union(v.literal('resend'))

export const emailTemplateKeyValidator = v.union(
  v.literal('verification'),
  v.literal('acknowledgment'),
  v.literal('more_information_needed'),
  v.literal('completion'),
  v.literal('denial_update')
)

export const emailLogStatusValidator = v.union(
  v.literal('draft'),
  v.literal('queued'),
  v.literal('sent'),
  v.literal('failed')
)

export const emailDeliveryModeValidator = v.union(
  v.literal('simulated'),
  v.literal('provider')
)

export const emailSenderSourceValidator = v.union(
  v.literal('platform'),
  v.literal('workspace')
)

export const workspaceSenderStatusValidator = v.union(
  v.literal('draft'),
  v.literal('not_started'),
  v.literal('pending'),
  v.literal('verified'),
  v.literal('failed'),
  v.literal('temporary_failure'),
  v.literal('disabled')
)

export const workspaceSenderFallbackModeValidator = v.union(v.literal('platform'))
