# Implementation Plan — Project Management SaaS Backend Conversion

## Codebase Summary (read before implementing)

- **Runtime**: Node.js ESM (`"type": "module"` in package.json), TypeScript, Express 5
- **ORM**: Prisma 7 with generated client at `src/generated/prisma/`
- **Enums confirmed in generated client**: `Role` = `ADMIN | MANAGER | MEMBER`. No `DOCTOR`, `PATIENT`, or `SUPER_ADMIN` exist.
- **Critical field name gotcha**: The Prisma schema defines `imagePublicId` (camelCase, capital P and I). The current `user.service.ts` uses `imagepublicId` (all lowercase after "image") which is **wrong** and will cause a Prisma type error — fix it everywhere.
- **Build command**: `npm run build` (tsc)
- **Dev command**: `npm run dev` (tsx watch)
- **No test runner** configured — verification is `npm run build` succeeding with zero TypeScript errors.
- **Linter**: Biome — run `npm run lint:check` after each step to catch import issues early.

---

## Step 1 — Install missing packages: helmet and express-rate-limit

These are needed by Step 16 (app.ts). Install them first so TypeScript can resolve the types throughout.

**What to do**: Install `helmet` and `express-rate-limit` as production dependencies, plus their `@types/*` packages as dev dependencies.

**Files modified**: `package.json`, `package-lock.json` (auto-updated by npm)

**Command**:
```
npm install helmet express-rate-limit
npm install --save-dev @types/helmet @types/express-rate-limit
```

**Verify**: `npm run build` — no "cannot find module 'helmet'" or "cannot find module 'express-rate-limit'" errors. (There will still be TS errors from old healthcare imports at this stage — that is expected and will be fixed in Steps 15–17.)

---

## Step 2 — Update `src/app/config/index.ts`

Replace the `tester_doctor_*` config keys with `tester_member_*`. The `super_admin_*` keys are kept because we still seed an ADMIN user using those env names (Step 9). Also keep all existing keys; only rename the doctor-specific ones.

**What to do**:
1. Remove `tester_doctor_name`, `tester_doctor_email`, `tester_doctor_password`.
2. Add `tester_member_name`, `tester_member_email`, `tester_member_password` reading from `process.env.TESTER_MEMBER_NAME`, etc.
3. Keep `super_admin_name/email/password` and all other keys unchanged.

**Files modified**: `src/app/config/index.ts`

**Verify**: `npm run build` — config file compiles without errors.

---

## Step 3 — Update `src/app/module/auth/auth.interface.ts`

Remove the patient-specific interface and rename to generic user registration.

**What to do**:
1. Rename `IRegisterPatientPayload` → `IRegisterUserPayload`.
2. Remove the `patient` field from that interface entirely (registration now takes only `name`, `email`, `password`).
3. Leave all other interfaces (`ILoginUserPayload`, `IVerifiEmailPayload`, `IRequestUser`, `IGoogleLoginPayload`, `IForgotPasswordPayload`, `IResetPasswordPayload`) unchanged.

**Files modified**: `src/app/module/auth/auth.interface.ts`

**Verify**: File saves cleanly; TypeScript errors about the old name surface in `auth.service.ts` — that is expected, fixed in Step 4.

---

## Step 4 — Update `src/app/module/auth/auth.validation.ts`

Remove the `patient` nested object from the registration schema and rename the schemas.

**What to do**:
1. Rename `patientRegisterZodSchema` → `userRegisterZodSchema`. Remove the `patient: z.object({...}).optional()` field. Keep `name`, `email`, `password` fields. Increase `name` max from 10 to 50 (current limit of 10 is too restrictive).
2. Rename `patientEmailVerifyZodSchema` → `userEmailVerifyZodSchema` (keep `email` + `otp` fields).
3. Keep `loginzodSchema`, `ForgotPasswordZodSchema`, `ResetPasswordZodSchema` unchanged.
4. Update the exported object `uservalidation` to use the new names.

**Files modified**: `src/app/module/auth/auth.validation.ts`

**Verify**: `npm run build` — validation file compiles; errors from controller/route using old names surface in Step 5–6.

---

## Step 5 — Update `src/app/module/auth/auth.service.ts`

This is the biggest auth change. Replace all patient/doctor-specific logic with plain user logic.

**What to do**:

**5a — `registerPatient` → `registerUser`**:
- Rename function to `registerUser`, parameter type to `IRegisterUserPayload`.
- Change redis key prefixes from `patient-registration-otp:` → `user-registration-otp:` and `patient-registration-data:` → `user-registration-data:`.
- Remove `patient: patientData` from the `redisUserDataPayload` (store only `name`, `email`, `password`).

**5b — `verifyPatientEmail` → `verifyUserEmail`**:
- Rename function to `verifyUserEmail`.
- Change redis key lookups to use `user-registration-otp:` and `user-registration-data:`.
- Parse stored data as `IRegisterUserPayload` (no patient field).
- Replace the `prisma.user.create` call: remove the `patient: { create: {...} }` nested create, remove `role: Role.PATIENT`, use `role: Role.MEMBER`.
- Remove `omit: { password: true }` workaround with the patient relation include — just use `omit: { password: true }` without `include: { patient: true }`.
- Remove `const { patient, ...user } = createdUser` destructuring. Return `{ user, accessToken, refreshToken }` (no patient field).
- Change welcome email template path to `src/app/templates/patient-welcom.ejs` (file still exists, keep using it for now).
- Change welcome email subject from "Welcome to PH Healthcare System" → "Welcome to ProjectHub".

**5c — `getMe`**:
- Remove `include: { patient: true }` from the `prisma.user.findUnique` call. Keep `omit: { password: true }`.

**5d — `googleLogin`**:
- Replace all occurrences of `Role.PATIENT` with `Role.MEMBER`.
- Remove the `ifPatientExistWithGoogleAuth` / `ifPatientExistWithCredentials` variable names — rename to `ifUserExistWithGoogleAuth` / `ifUserExistWithCredentials` (clarity, not required but strongly recommended).
- Remove `patient: { create: {...} }` from the Google-register `prisma.user.create` call.
- Remove the `@unique` filter on `role` in the Google `findUnique` call — the schema has a unique index on email so filtering by role in `findUnique` is invalid with the new Prisma v7 types. Use `prisma.user.findUnique({ where: { email: ... } })` then check role manually.
- Change welcome email subject to "Welcome to ProjectHub".

**5e — Update exports at bottom**: Rename `registerPatient` → `registerUser`, `verifyPatientEmail` → `verifyUserEmail` in the `AuthService` export object.

**Import cleanup**: Remove the `IRegisterPatientPayload` import, replace with `IRegisterUserPayload`.

**Files modified**: `src/app/module/auth/auth.service.ts`

**Verify**: `npm run build` — auth service compiles without errors (except for any still-unresolved references in controller/route, which are fixed next).

---

## Step 6 — Update `src/app/module/auth/auth.controller.ts`

Rename the two patient-specific controllers to match the renamed service methods.

**What to do**:
1. Rename `registerPatient` → `registerUser`. Update the `AuthService.registerPatient(...)` call to `AuthService.registerUser(...)`.
2. Rename `verifiPatientEmail` → `verifyUserEmail`. Update the `AuthService.verifyPatientEmail(...)` call to `AuthService.verifyUserEmail(...)`.
3. In `verifyUserEmail`, remove `patient` from the destructured result (`const { accessToken, refreshToken, user } = result`) and remove `patient` from the `sendResponse` data.
4. Update the `AuthController` export object to use the new names.

**Files modified**: `src/app/module/auth/auth.controller.ts`

**Verify**: `npm run build` — controller compiles cleanly.

---

## Step 7 — Update `src/app/module/auth/auth.route.ts`

Fix all role references and rename route handlers.

**What to do**:
1. Replace `AuthController.registerPatient` → `AuthController.registerUser`.
2. Replace `AuthController.verifiPatientEmail` → `AuthController.verifyUserEmail`.
3. Replace `uservalidation.patientRegisterZodSchema` → `uservalidation.userRegisterZodSchema`.
4. Replace `uservalidation.patientEmailVerifyZodSchema` → `uservalidation.userEmailVerifyZodSchema`.
5. Fix the `/me` route: replace `auth(Role.ADMIN, Role.DOCTOR, Role.PATIENT, Role.SUPER_ADMIN)` with `auth(Role.ADMIN, Role.MANAGER, Role.MEMBER)`.

**Files modified**: `src/app/module/auth/auth.route.ts`

**Verify**: `npm run build` — no TypeScript errors in auth module.

---

## Step 8 — Update `src/app/module/user/user.service.ts`

Fix the `imagePublicId` field name bug.

**What to do**:
1. In `UploadProfileImage`, change `select: { imagepublicId: true, ... }` → `select: { imagePublicId: true, ... }`.
2. Change `data: { imageUrl: ..., imagepublicId: ... }` → `data: { imageUrl: ..., imagePublicId: ... }`.
3. Change the subsequent check `if (currentUser?.imagepublicId)` → `if (currentUser?.imagePublicId)`.
4. Change `await cloudinary.uploader.destroy(currentUser.imagepublicId)` → `await cloudinary.uploader.destroy(currentUser.imagePublicId)`.

**Files modified**: `src/app/module/user/user.service.ts`

**Verify**: `npm run build` — no `imagepublicId` errors from Prisma types.

---

## Step 9 — Update `src/app/module/user/user.route.ts`

Remove the old invalid roles from the profile image upload route.

**What to do**:
1. Replace `auth(Role.SUPER_ADMIN, Role.ADMIN, Role.DOCTOR, Role.PATIENT)` with `auth(Role.ADMIN, Role.MANAGER, Role.MEMBER)`.
2. Also add a `GET /me` and `PATCH /me` route for profile management:
   - `GET /me` → calls a new `getUserProfile` controller (reads from `prisma.user.findUnique({ where: { id: userId }, omit: { password: true } })`).
   - `PATCH /me` → calls a new `updateUserProfile` controller (allows updating `name` only; email is immutable; input validated with a small zod schema `{ name: z.string().min(2).max(50) }`).
3. Add these two service methods to `user.service.ts` and the two controller methods to `user.controller.ts` as well (all in this same step since it's one coherent user-profile feature).

**Files modified**:
- `src/app/module/user/user.route.ts`
- `src/app/module/user/user.service.ts`
- `src/app/module/user/user.controller.ts`

**Verify**: `npm run build` — user module compiles cleanly.

---

## Step 10 — Rewrite `src/app/utils/seed.ts`

Replace the old SUPER_ADMIN / DOCTOR seed logic with ADMIN / MANAGER / MEMBER.

**What to do**:
1. Remove `seedsuperAdmin` and `seedTesterDoctor` functions entirely.
2. Keep `seedTesterAdmin` (it seeds an ADMIN role user, which is still valid).
3. Rename the function from `seedTesterAdmin` → keep that name, but also add a new `seedTesterMember` function that seeds a MEMBER user using `config.tester_member_name/email/password`.
4. Add a `seedAdminUser` function (replaces `seedsuperAdmin`) that seeds the first ADMIN from `config.super_admin_name/email/password` if no ADMIN exists yet.

```typescript
// New seed.ts export shape
export const seedAdminUser = async () => { ... }   // uses super_admin_* env vars, seeds Role.ADMIN
export const seedTesterAdmin = async () => { ... }  // uses tester_admin_* env vars, seeds Role.ADMIN
export const seedTesterMember = async () => { ... } // uses tester_member_* env vars, seeds Role.MEMBER
```

Remove all imports of `DoctorVerificationStatus` and `Role.DOCTOR`.

**Files modified**: `src/app/utils/seed.ts`

**Verify**: `npm run build` — seed.ts compiles with zero errors.

---

## Step 11 — Create `src/app/utils/activityLog.ts`

A helper to create activity log entries cleanly from any service.

**What to do**: Create a new file with a single exported function `createActivityLog`. The function signature:

```typescript
import { ActivityAction } from "../../generated/prisma/enums";
import { prisma } from "../lib/prisma";

interface IActivityLogInput {
  action: ActivityAction;
  entityType: "PROJECT" | "TASK" | "COMMENT" | "PAYMENT" | "ORGANIZATION";
  entityId: string;
  userId: string;
  organizationId: string;
  projectId?: string;
  taskId?: string;
  details?: Record<string, unknown>;
}

export const createActivityLog = async (input: IActivityLogInput): Promise<void> => {
  await prisma.activityLog.create({ data: input });
};
```

**Files created**: `src/app/utils/activityLog.ts`

**Verify**: `npm run build` — new utility compiles cleanly.

---

## Step 12 — Create the Organization module

Create all 5 files for the organization module.

**Files to create**:
- `src/app/module/organization/organization.interface.ts`
- `src/app/module/organization/organization.validation.ts`
- `src/app/module/organization/organization.service.ts`
- `src/app/module/organization/organization.controller.ts`
- `src/app/module/organization/organization.route.ts`

### organization.interface.ts
```typescript
export interface ICreateOrganizationPayload {
  name: string;
  description?: string;
}
export interface IUpdateOrganizationPayload {
  name?: string;
  description?: string;
}
export interface IAddMemberPayload {
  userId: string;
  role?: "ADMIN" | "MANAGER" | "MEMBER";
}
```

### organization.validation.ts
```typescript
import z from "zod";
export const createOrgSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
});
export const updateOrgSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
});
export const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["ADMIN", "MANAGER", "MEMBER"]).optional().default("MEMBER"),
});
export const orgValidation = { createOrgSchema, updateOrgSchema, addMemberSchema };
```

### organization.service.ts — key logic per endpoint
- **createOrganization(userId, payload)**: `prisma.$transaction` — create Organization with `ownerId: userId`, then create an `OrganizationMember` record for the creator with `role: Role.ADMIN`. Log `ActivityAction.CREATED`. Return the org.
- **getMyOrganizations(userId)**: `prisma.organization.findMany({ where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }], isDeleted: false } })`.
- **getOrganizationById(orgId, userId)**: Find org by id where `isDeleted: false`. Verify user is a member or owner (throw 403 if not). Include `members` and `projects` counts.
- **updateOrganization(orgId, userId, payload)**: Verify caller is ADMIN member of the org. Update org fields.
- **deleteOrganization(orgId, userId)**: Verify caller is the `ownerId`. Soft delete: `prisma.organization.update({ where: { id: orgId }, data: { isDeleted: true, deletedAt: new Date() } })`. Log `DELETED`.
- **addMember(orgId, callerId, payload)**: Verify caller is ADMIN of the org. Verify target userId exists. Create `OrganizationMember`. Log `ASSIGNED`.
- **removeMember(orgId, callerId, targetUserId)**: Verify caller is ADMIN and target is not the owner. Delete the `OrganizationMember` record. Log `UNASSIGNED`.
- **getMembers(orgId, userId)**: Verify user is a member. Return all non-deleted members with user info (`select: { user: { select: { id, name, email, imageUrl } }, role, joinedAt }`).
- **uploadOrgImage(orgId, userId, buffer)**: Verify caller is ADMIN. Upload to Cloudinary, update `organization.imageUrl`.

### organization.controller.ts
Standard pattern: `catchAsync` → call service → `sendResponse`. One controller per service method.

### organization.route.ts
```
POST   /                → auth(ADMIN, MANAGER, MEMBER) → createOrganization
GET    /                → auth(ADMIN, MANAGER, MEMBER) → getMyOrganizations
GET    /:orgId          → auth(ADMIN, MANAGER, MEMBER) → getOrganizationById
PATCH  /:orgId          → auth(ADMIN, MANAGER, MEMBER) → updateOrganization
DELETE /:orgId          → auth(ADMIN, MANAGER, MEMBER) → deleteOrganization
POST   /:orgId/members  → auth(ADMIN, MANAGER, MEMBER) → addMember
DELETE /:orgId/members/:userId → auth(ADMIN, MANAGER, MEMBER) → removeMember
GET    /:orgId/members  → auth(ADMIN, MANAGER, MEMBER) → getMembers
PATCH  /:orgId/image    → auth(ADMIN, MANAGER, MEMBER) → upload.single("orgImage") → uploadOrgImage
```

**Files created**: 5 files listed above

**Verify**: `npm run build` — no errors in the organization module.

---

## Step 13 — Create the Project module

Create all 5 files for the project module. Projects live inside an organization.

**Files to create**:
- `src/app/module/project/project.interface.ts`
- `src/app/module/project/project.validation.ts`
- `src/app/module/project/project.service.ts`
- `src/app/module/project/project.controller.ts`
- `src/app/module/project/project.route.ts`

### project.interface.ts
```typescript
export interface ICreateProjectPayload {
  name: string;
  description?: string;
  deadline?: string; // ISO date string
}
export interface IUpdateProjectPayload {
  name?: string;
  description?: string;
  deadline?: string;
  status?: "ACTIVE" | "ARCHIVED" | "COMPLETED";
}
```

### project.validation.ts
```typescript
import z from "zod";
export const createProjectSchema = z.object({
  name: z.string().min(2).max(150),
  description: z.string().max(1000).optional(),
  deadline: z.iso.datetime().optional(),
});
export const updateProjectSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  description: z.string().max(1000).optional(),
  deadline: z.iso.datetime().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED", "COMPLETED"]).optional(),
});
export const projectValidation = { createProjectSchema, updateProjectSchema };
```

### project.service.ts — key logic per endpoint
All project operations require the caller to be a member of the parent organization.

- **createProject(orgId, userId, payload)**: Verify user is an org member. Create project with `organizationId: orgId`. Log `CREATED`.
- **getProjects(orgId, userId, query)**: Verify membership. Support pagination (`page`, `limit`), filter by `status`, sort by `createdAt` or `deadline`. Exclude `isDeleted: true`. Return `{ data, meta: { page, limit, total, totalPages } }`.
- **getProjectById(projectId, userId)**: Find project, verify user is member of its org.
- **updateProject(projectId, userId, payload)**: Verify user is ADMIN or MANAGER of the org. Update project. Log `UPDATED`.
- **deleteProject(projectId, userId)**: Verify user is ADMIN of the org. Soft delete. Log `DELETED`.
- **changeProjectStatus(projectId, userId, status)**: Verify user is ADMIN or MANAGER. Update `status` field. Log `STATUS_CHANGED`.

### project.route.ts
```
POST   /orgs/:orgId/projects              → auth(all) → createProject
GET    /orgs/:orgId/projects              → auth(all) → getProjects
GET    /orgs/:orgId/projects/:projectId   → auth(all) → getProjectById
PATCH  /orgs/:orgId/projects/:projectId   → auth(all) → updateProject
DELETE /orgs/:orgId/projects/:projectId   → auth(all) → deleteProject
PATCH  /orgs/:orgId/projects/:projectId/status → auth(all) → changeProjectStatus
```

**Routing note**: The project routes will be mounted at `/api/v1` in `app.ts`, so the full path is `/api/v1/orgs/:orgId/projects`.

**Files created**: 5 files listed above

**Verify**: `npm run build` — project module compiles cleanly.

---

## Step 14 — Create the Task module

**Files to create**:
- `src/app/module/task/task.interface.ts`
- `src/app/module/task/task.validation.ts`
- `src/app/module/task/task.service.ts`
- `src/app/module/task/task.controller.ts`
- `src/app/module/task/task.route.ts`

### task.interface.ts
```typescript
export interface ICreateTaskPayload {
  title: string;
  description?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate?: string;
  assigneeId?: string;
}
export interface IUpdateTaskPayload {
  title?: string;
  description?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate?: string;
  assigneeId?: string | null;
  status?: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
}
```

### task.validation.ts
Zod schemas matching the interfaces above.

### task.service.ts — key logic
- **createTask(projectId, userId, payload)**: Verify user is org member. If `assigneeId` provided, verify assignee is also an org member. Create task with `creatorId: userId`, `projectId`. Log `CREATED`.
- **getTasks(projectId, userId, query)**: Verify membership. Pagination + filter by `status`, `priority`, `assigneeId`. Search by `title` (`contains: q, mode: 'insensitive'`). Exclude `isDeleted: true`.
- **getTaskById(taskId, userId)**: Find task, verify user is org member.
- **updateTask(taskId, userId, payload)**: Verify user is org member (any member can update for now; ADMIN/MANAGER can reassign). If status changes, log `STATUS_CHANGED`. If assignee changes, log `ASSIGNED` or `UNASSIGNED`. Otherwise log `UPDATED`.
- **deleteTask(taskId, userId)**: Verify ADMIN or MANAGER. Soft delete. Log `DELETED`.
- **assignTask(taskId, userId, assigneeId)**: Verify caller is ADMIN or MANAGER. Verify assignee is org member. Update `assigneeId`. Log `ASSIGNED`.
- **getMyAssignedTasks(userId, query)**: `prisma.task.findMany({ where: { assigneeId: userId, isDeleted: false } })` with pagination.

### task.route.ts
```
POST   /projects/:projectId/tasks             → auth(all) → createTask
GET    /projects/:projectId/tasks             → auth(all) → getTasks
GET    /projects/:projectId/tasks/:taskId     → auth(all) → getTaskById
PATCH  /projects/:projectId/tasks/:taskId     → auth(all) → updateTask
DELETE /projects/:projectId/tasks/:taskId     → auth(all) → deleteTask
POST   /projects/:projectId/tasks/:taskId/assign → auth(ADMIN,MANAGER) → assignTask
GET    /tasks/my-assigned                     → auth(all) → getMyAssignedTasks
```

**Files created**: 5 files listed above

**Verify**: `npm run build` — task module compiles cleanly.

---

## Step 15 — Create the Comment module

**Files to create**:
- `src/app/module/comment/comment.validation.ts`
- `src/app/module/comment/comment.service.ts`
- `src/app/module/comment/comment.controller.ts`
- `src/app/module/comment/comment.route.ts`

### comment.validation.ts
```typescript
import z from "zod";
export const createCommentSchema = z.object({ content: z.string().min(1).max(2000) });
export const updateCommentSchema = z.object({ content: z.string().min(1).max(2000) });
export const commentValidation = { createCommentSchema, updateCommentSchema };
```

### comment.service.ts — key logic
- **createComment(taskId, userId, content)**: Verify user is org member of the task's project's org. Create comment with `authorId: userId`, `taskId`. Log `COMMENTED`.
- **getComments(taskId, userId)**: Verify membership. Return all non-deleted comments ordered by `createdAt asc`, include author name/imageUrl.
- **updateComment(commentId, userId, content)**: Verify `comment.authorId === userId` (only author can edit). Update `content`.
- **deleteComment(commentId, userId)**: Verify `comment.authorId === userId` OR user is ADMIN/MANAGER of the org. Soft delete.

### comment.route.ts
```
POST   /tasks/:taskId/comments               → auth(all) → createComment
GET    /tasks/:taskId/comments               → auth(all) → getComments
PATCH  /tasks/:taskId/comments/:commentId    → auth(all) → updateComment
DELETE /tasks/:taskId/comments/:commentId    → auth(all) → deleteComment
```

**Files created**: 4 files listed above

**Verify**: `npm run build` — comment module compiles cleanly.

---

## Step 16 — Create the Payment module

This module handles bKash subscription payments. Uses the existing `src/app/lib/bkash.ts`.

**Files to create**:
- `src/app/module/payment/payment.service.ts`
- `src/app/module/payment/payment.controller.ts`
- `src/app/module/payment/payment.route.ts`

### Payment flow (bKash tokenized checkout)
1. **`initiatePayment`** (`POST /payments/initiate`): User provides `organizationId` and `plan` (PRO). Look up org, verify caller is ADMIN. Create a `Payment` record in DB with `status: UNPAID`. Call bKash `createpayment` API using `getBkashIdToken()`. Store `bkashPaymentId` on the record. Return the bKash `bkashURL` to redirect user.
2. **`paymentCallback`** (`GET /payments/callback`): This is the bKash callback URL. Receives `paymentID` and `status` as query params. If `status === 'success'`, call bKash `executepayment` API. On success, update `Payment` to `status: PAID`, set `bkashTrxId`, `paidAt`. Then upsert `Subscription` for the org (`plan: PRO`, `endDate: now + 30 days`, `isActive: true`). Log `PAYMENT_MADE`. If status is not success, update Payment to `CANCELLED`. Redirect response or return JSON based on `Content-Type`.
3. **`getPaymentById`** (`GET /payments/:paymentId`): Return payment with subscription info. Auth required.
4. **`getMyPayments`** (`GET /payments/my`): Return all payments for the calling user, paginated.

**Gotcha — bKash callback URL**: The `bkash_callback_url` config value must be the publicly reachable URL of the `/api/v1/payments/callback` endpoint. The callback is a GET with query params from bKash, so the route must be `router.get("/callback", ...)` without `auth()` middleware (bKash calls it unauthenticated).

**Files created**: 3 files listed above

**Verify**: `npm run build` — payment module compiles cleanly.

---

## Step 17 — Create the Admin module

**Files to create**:
- `src/app/module/admin/admin.service.ts`
- `src/app/module/admin/admin.controller.ts`
- `src/app/module/admin/admin.route.ts`

### admin.service.ts — key logic
All methods require `auth(Role.ADMIN)`.

- **getAllUsers(query)**: Paginated list of all users. Support `searchTerm` (searches `name`, `email`), `status` filter, `sortBy`, `sortOrder`. Include `isDeleted: false` filter by default (unless `showDeleted=true` query param). Return `{ data, meta }`.
- **updateUserRole(targetUserId, role)**: Validates role is `ADMIN | MANAGER | MEMBER`. Update user role. Log action. Return updated user.
- **blockUser(targetUserId)**: Set `status: BLOCKED`. Return updated user.
- **getDashboardStats()**: Single Prisma call structure using `prisma.$transaction`:
  - total users (`count`)
  - total organizations
  - total projects
  - total tasks
  - tasks by status (group by `status`)
  - recent activity (last 10 activity logs, include user name)
- **getAuditLogs(query)**: Paginated activity logs. Support filter by `entityType`, `action`, `organizationId`. Order by `createdAt desc`. Include `user: { select: { name, email } }`.
- **softDeleteUser(targetUserId)**: Set `isDeleted: true`, `deletedAt: new Date()`, `status: DELETED`. Returns updated user.

### admin.route.ts
```
GET    /users                   → auth(ADMIN) → getAllUsers
PATCH  /users/:userId/role      → auth(ADMIN) → updateUserRole
PATCH  /users/:userId/block     → auth(ADMIN) → blockUser
DELETE /users/:userId           → auth(ADMIN) → softDeleteUser
GET    /dashboard-stats         → auth(ADMIN) → getDashboardStats
GET    /audit-logs              → auth(ADMIN) → getAuditLogs
```

**Files created**: 3 files listed above

**Verify**: `npm run build` — admin module compiles cleanly.

---

## Step 18 — Update `src/app.ts`

Replace all old healthcare route imports with the new module routes; add `helmet` and `express-rate-limit`.

**What to do**:
1. Remove imports for `appointmentRoutes`, `DoctorRoutes`, `ScheduleRoutes`, `paymentRoutes`, `prescriptionRoutes`, `analyticsRoutes` (these modules are deleted).
2. Add imports for the 6 new modules: `OrganizationRoutes`, `ProjectRoutes`, `TaskRoutes`, `CommentRoutes`, `PaymentRoutes`, `AdminRoutes`.
3. Add `import helmet from "helmet"` and `import rateLimit from "express-rate-limit"`.
4. Add middleware **before** routes:
   ```typescript
   app.use(helmet());
   const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 });
   app.use("/api", limiter);
   ```
5. Remove old route registrations and register new ones:
   ```typescript
   app.use("/api/v1/auth", AuthRoutes);
   app.use("/api/v1/users", UserRoutes);      // note: /users not /user
   app.use("/api/v1/organizations", OrganizationRoutes);
   app.use("/api/v1", ProjectRoutes);         // routes start with /orgs/:orgId/projects
   app.use("/api/v1", TaskRoutes);            // routes start with /projects/:projectId/tasks
   app.use("/api/v1", CommentRoutes);         // routes start with /tasks/:taskId/comments
   app.use("/api/v1/payments", PaymentRoutes);
   app.use("/api/v1/admin", AdminRoutes);
   ```
6. Update root health check response to say "Welcome to ProjectHub API".

**Files modified**: `src/app.ts`

**Verify**: `npm run build` — app.ts compiles with zero errors; no more missing-module errors.

---

## Step 19 — Update `src/server.ts`

Remove dead imports and replace seed calls.

**What to do**:
1. Remove `import { deletUnverifiedDoctor } from "./app/lib/cron"`.
2. Remove `import { seedsuperAdmin, seedTesterAdmin, seedTesterDoctor } from "./app/utils/seed"`.
3. Add `import { seedAdminUser, seedTesterAdmin, seedTesterMember } from "./app/utils/seed"`.
4. Replace the seed call block:
   ```typescript
   // Old:
   await seedsuperAdmin();
   await seedTesterAdmin();
   await seedTesterDoctor();
   await deletUnverifiedDoctor();

   // New:
   await seedAdminUser();
   await seedTesterAdmin();
   await seedTesterMember();
   ```
5. Keep `prisma.$connect()`, `redisClient.connect()`, `transpost.verify()` calls unchanged.

**Files modified**: `src/server.ts`

**Verify**: `npm run build` — zero TypeScript errors across the entire project. Run `npm run lint:check` to confirm no Biome lint violations.

---

## Step 20 — Final integration check and API count verification

**What to do**:
1. Run `npm run build` — must exit with code 0.
2. Count all registered API endpoints and confirm ≥ 20:

| Module | Endpoints |
|--------|-----------|
| Auth | register, verify-email, login, me (GET), refresh-token, google, forgot-password, reset-password = **8** |
| Users | me (GET), me (PATCH), profile-image (PATCH) = **3** |
| Organizations | create, list, get, update, delete, add-member, remove-member, get-members, upload-image = **9** |
| Projects | create, list, get, update, delete, change-status = **6** |
| Tasks | create, list, get, update, delete, assign, my-assigned = **7** |
| Comments | create, list, update, delete = **4** |
| Payments | initiate, callback, get-by-id, my-payments = **4** |
| Admin | list-users, update-role, block-user, delete-user, dashboard-stats, audit-logs = **6** |
| **Total** | **47** |

3. Confirm soft-delete is implemented on: users, organizations, projects, tasks, comments.
4. Confirm pagination + filtering is on: `GET /organizations` (via membership), `GET /projects`, `GET /tasks`, `GET /admin/users`, `GET /admin/audit-logs`.
5. Confirm activity logs are created for: org create/delete, project create/update/delete/status-change, task create/update/delete/assign, comment create, payment made.

**Verify**: `npm run build` exits 0. `npm run lint:check` exits 0.

---

## Appendix — Key Gotchas

1. **`imagePublicId` casing**: The Prisma schema and generated client use `imagePublicId` (capital P and I). The old `user.service.ts` incorrectly used `imagepublicId`. Fix in Step 8. If you see `Object literal may only specify known properties` from Prisma, this is the cause.

2. **`Role.PATIENT` / `Role.DOCTOR` / `Role.SUPER_ADMIN` do not exist** in the generated `src/generated/prisma/enums.ts`. Any reference to these will cause a TypeScript compile error. They were from the old schema and are completely gone from the generated client.

3. **`patient` relation does not exist on `User`**: The `UserCreateInput` type in the generated client has no `patient` nested create input. Any `prisma.user.create({ data: { patient: { create: ... } } })` will error. Remove all such references.

4. **`prisma.user.findUnique` with `role` filter**: Prisma's `findUnique` only works on `@unique` and `@id` fields. `role` is not unique. In the old `googleLogin`, there were `findUnique({ where: { email: ..., role: ... } })` calls — these are invalid with Prisma v7 strict types. Use `findUnique({ where: { email: ... } })` then check role programmatically.

5. **`nodemailer` import**: The existing code uses `transpost` (typo for `transport`) — keep using `transpost` as it is already consistent everywhere. Don't rename it.

6. **ESM imports**: The project uses `"type": "module"`. Do not use `require()`. All imports must be ES module syntax. The `tsconfig.json` has `"moduleResolution": "bundler"` — imports don't need `.js` extensions with `tsx`.

7. **bKash callback is unauthenticated**: The `GET /payments/callback` route must NOT have `auth()` middleware. bKash calls it directly and does not send a Bearer token.

8. **Subscription upsert on payment success**: Use `prisma.subscription.upsert` with `where: { organizationId }` to handle both first-time and renewal payment flows cleanly.

9. **`z.iso.datetime()`**: Zod v4 (installed as `zod@^4.6.5`) uses `z.iso.datetime()` not `z.string().datetime()`. Use the v4 API throughout.

10. **`http-status` v2**: The installed `http-status@^2.1.0` uses named exports. The existing code already uses this correctly (`httpStatus.OK`, `httpStatus.CREATED`, etc.) — keep that pattern.
