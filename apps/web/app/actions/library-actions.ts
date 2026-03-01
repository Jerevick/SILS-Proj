"use server";

/**
 * Phase 23: Library Services & Resource Integration.
 * Server actions: LibrarySearch, AddToReadingList, ManageReserves (get/create/update/delete).
 * Scoped for Librarian/Faculty/Course Coordinator (INSTRUCTOR, ADMIN, OWNER).
 */

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant-context";
import { prisma } from "@/lib/db";
import type { LibraryResourceType, LibraryAccessLevel } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LibrarySearchFilters = {
  type?: LibraryResourceType | "";
  accessLevel?: LibraryAccessLevel | "";
  availability?: "available" | "all"; // available = availableCopies > 0
};

export type LibrarySearchInput = {
  query?: string;
  filters?: LibrarySearchFilters;
};

export type LibraryResourceItem = {
  id: string;
  tenantId: string;
  title: string;
  author: string | null;
  isbn: string | null;
  type: string;
  url: string | null;
  accessLevel: string;
  availableCopies: number;
  createdAt: string;
  updatedAt: string;
};

/** Stub for external catalog integration (e.g. WorldCat, Open Library). */
export type ExternalResourceStub = {
  externalId: string;
  title: string;
  author?: string;
  type: string;
  source: string;
  url?: string;
};

export type LibrarySearchResult =
  | { ok: true; resources: LibraryResourceItem[]; externalStub?: ExternalResourceStub[] }
  | { ok: false; error: string };

export type AddToReadingListInput = {
  programmeId: string;
  moduleId?: string | null;
  readingListName: string;
  resourceId: string;
  required?: boolean;
};

export type AddToReadingListResult =
  | { ok: true; readingListId: string; itemId: string }
  | { ok: false; error: string };

export type ReserveItem = {
  id: string;
  resourceId: string;
  resourceTitle: string;
  programmeId: string;
  programmeName: string;
  availableFrom: string;
  availableTo: string;
};

export type GetReservesResult =
  | { ok: true; reserves: ReserveItem[] }
  | { ok: false; error: string };

export type CreateReserveInput = {
  resourceId: string;
  programmeId: string;
  availableFrom: string; // ISO date
  availableTo: string;
};

export type CreateReserveResult =
  | { ok: true; reserveId: string }
  | { ok: false; error: string };

export type UpdateReserveInput = {
  reserveId: string;
  availableFrom?: string;
  availableTo?: string;
};

export type ManageReserveResult =
  | { ok: true }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireTenant() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { ok: false as const, error: "Unauthorized" };
  const tenantResult = await getTenantContext(orgId, userId);
  if (!tenantResult.ok) return { ok: false as const, error: "Tenant not found" };
  return {
    ok: true as const,
    userId,
    tenantId: tenantResult.context.tenantId,
    role: tenantResult.context.role,
  };
}

function canManageLibrary(role: string) {
  return role === "OWNER" || role === "ADMIN" || role === "INSTRUCTOR";
}

// ---------------------------------------------------------------------------
// LibrarySearch
// ---------------------------------------------------------------------------

/**
 * Search library resources with optional filters. Includes stub for external catalog integration.
 */
export async function librarySearch(
  input: LibrarySearchInput
): Promise<LibrarySearchResult> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const query = input.query?.trim() ?? "";
  const filters = input.filters ?? {};

  try {
    const where: Parameters<typeof prisma.libraryResource.findMany>[0]["where"] = {
      tenantId: ctx.tenantId,
    };

    if (query) {
      where.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { author: { contains: query, mode: "insensitive" } },
        { isbn: { contains: query, mode: "insensitive" } },
      ];
    }

    if (filters.type && filters.type !== "") {
      where.type = filters.type as LibraryResourceType;
    }
    if (filters.accessLevel && filters.accessLevel !== "") {
      where.accessLevel = filters.accessLevel as LibraryAccessLevel;
    }
    if (filters.availability === "available") {
      where.availableCopies = { gt: 0 };
    }

    const resources = await prisma.libraryResource.findMany({
      where,
      orderBy: [{ title: "asc" }],
      take: 100,
    });

    const items: LibraryResourceItem[] = resources.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      title: r.title,
      author: r.author,
      isbn: r.isbn,
      type: r.type,
      url: r.url,
      accessLevel: r.accessLevel,
      availableCopies: r.availableCopies,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    // External stub: simulate external catalog results (e.g. WorldCat/Open Library)
    const externalStub: ExternalResourceStub[] = query
      ? [
          {
            externalId: `ext-${Date.now()}-1`,
            title: `[External] ${query} – Sample result 1`,
            author: "External Author",
            type: "book",
            source: "external_stub",
            url: "https://example.com/catalog/1",
          },
        ]
      : [];

    return { ok: true, resources: items, externalStub };
  } catch (e) {
    console.error("LibrarySearch error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Search failed.",
    };
  }
}

/** Create a library resource (librarian/admin). */
export type CreateLibraryResourceInput = {
  title: string;
  author?: string | null;
  isbn?: string | null;
  type: LibraryResourceType;
  url?: string | null;
  accessLevel?: LibraryAccessLevel;
  availableCopies?: number;
};

export type CreateLibraryResourceResult =
  | { ok: true; resourceId: string }
  | { ok: false; error: string };

export async function createLibraryResource(
  input: CreateLibraryResourceInput
): Promise<CreateLibraryResourceResult> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageLibrary(ctx.role)) {
    return { ok: false, error: "Insufficient role to add library resources." };
  }
  const title = input.title?.trim();
  if (!title) return { ok: false, error: "Title is required." };
  try {
    const r = await prisma.libraryResource.create({
      data: {
        tenantId: ctx.tenantId,
        title,
        author: input.author?.trim() || null,
        isbn: input.isbn?.trim() || null,
        type: input.type,
        url: input.url?.trim() || null,
        accessLevel: input.accessLevel ?? "OPEN",
        availableCopies: Math.max(0, input.availableCopies ?? 0),
      },
    });
    return { ok: true, resourceId: r.id };
  } catch (e) {
    console.error("CreateLibraryResource error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to create resource.",
    };
  }
}

// ---------------------------------------------------------------------------
// AddToReadingList
// ---------------------------------------------------------------------------

/**
 * Add a resource to a programme or programme-module reading list. Finds or creates the list by name.
 */
export async function addToReadingList(
  input: AddToReadingListInput
): Promise<AddToReadingListResult> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageLibrary(ctx.role)) {
    return { ok: false, error: "Insufficient role to manage reading lists." };
  }

  const name = input.readingListName?.trim();
  if (!name) return { ok: false, error: "Reading list name is required." };

  try {
    const programme = await prisma.programme.findFirst({
      where: { id: input.programmeId, department: { tenantId: ctx.tenantId } },
    });
    if (!programme) return { ok: false, error: "Programme not found." };

    const resource = await prisma.libraryResource.findFirst({
      where: { id: input.resourceId, tenantId: ctx.tenantId },
    });
    if (!resource) return { ok: false, error: "Resource not found." };

    if (input.moduleId) {
      const module = await prisma.programmeModule.findFirst({
        where: {
          id: input.moduleId,
          programmeId: input.programmeId,
        },
      });
      if (!module) return { ok: false, error: "Module not found." };
    }

    let readingList = await prisma.readingList.findFirst({
      where: {
        programmeId: input.programmeId,
        moduleId: input.moduleId ?? null,
        name,
      },
    });

    if (!readingList) {
      readingList = await prisma.readingList.create({
        data: {
          programmeId: input.programmeId,
          moduleId: input.moduleId ?? null,
          name,
          createdBy: ctx.userId,
        },
      });
    }

    const existing = await prisma.readingListItem.findUnique({
      where: {
        readingListId_resourceId: {
          readingListId: readingList.id,
          resourceId: resource.id,
        },
      },
    });
    if (existing) {
      return { ok: true, readingListId: readingList.id, itemId: existing.id };
    }

    const item = await prisma.readingListItem.create({
      data: {
        readingListId: readingList.id,
        resourceId: resource.id,
        required: input.required ?? false,
      },
    });
    return { ok: true, readingListId: readingList.id, itemId: item.id };
  } catch (e) {
    console.error("AddToReadingList error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to add to reading list.",
    };
  }
}

// ---------------------------------------------------------------------------
// ManageReserves — get / create / update / delete
// ---------------------------------------------------------------------------

export async function getReserves(programmeId?: string | null): Promise<GetReservesResult> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageLibrary(ctx.role)) {
    return { ok: false, error: "Insufficient role to view reserves." };
  }

  try {
    const where: Parameters<typeof prisma.reserve.findMany>[0]["where"] = {
      resource: { tenantId: ctx.tenantId },
    };
    if (programmeId) where.programmeId = programmeId;

    const reserves = await prisma.reserve.findMany({
      where,
      include: {
        resource: { select: { id: true, title: true } },
        programme: { select: { id: true, name: true } },
      },
      orderBy: [{ availableFrom: "desc" }],
    });

    const items: ReserveItem[] = reserves.map((r) => ({
      id: r.id,
      resourceId: r.resourceId,
      resourceTitle: r.resource.title,
      programmeId: r.programmeId,
      programmeName: r.programme.name,
      availableFrom: r.availableFrom.toISOString().slice(0, 10),
      availableTo: r.availableTo.toISOString().slice(0, 10),
    }));
    return { ok: true, reserves: items };
  } catch (e) {
    console.error("GetReserves error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to load reserves.",
    };
  }
}

export async function createReserve(
  input: CreateReserveInput
): Promise<CreateReserveResult> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageLibrary(ctx.role)) {
    return { ok: false, error: "Insufficient role to manage reserves." };
  }

  const from = new Date(input.availableFrom);
  const to = new Date(input.availableTo);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return { ok: false, error: "Invalid dates." };
  }
  if (from > to) return { ok: false, error: "Available from must be before available to." };

  try {
    const resource = await prisma.libraryResource.findFirst({
      where: { id: input.resourceId, tenantId: ctx.tenantId },
    });
    if (!resource) return { ok: false, error: "Resource not found." };

    const programme = await prisma.programme.findFirst({
      where: { id: input.programmeId, department: { tenantId: ctx.tenantId } },
    });
    if (!programme) return { ok: false, error: "Programme not found." };

    const reserve = await prisma.reserve.create({
      data: {
        resourceId: input.resourceId,
        programmeId: input.programmeId,
        availableFrom: from,
        availableTo: to,
      },
    });
    return { ok: true, reserveId: reserve.id };
  } catch (e) {
    console.error("CreateReserve error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to create reserve.",
    };
  }
}

export async function updateReserve(
  input: UpdateReserveInput
): Promise<ManageReserveResult> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageLibrary(ctx.role)) {
    return { ok: false, error: "Insufficient role to manage reserves." };
  }

  try {
    const existing = await prisma.reserve.findFirst({
      where: {
        id: input.reserveId,
        resource: { tenantId: ctx.tenantId },
      },
    });
    if (!existing) return { ok: false, error: "Reserve not found." };

    const data: { availableFrom?: Date; availableTo?: Date } = {};
    if (input.availableFrom) {
      const d = new Date(input.availableFrom);
      if (!isNaN(d.getTime())) data.availableFrom = d;
    }
    if (input.availableTo) {
      const d = new Date(input.availableTo);
      if (!isNaN(d.getTime())) data.availableTo = d;
    }
    if (Object.keys(data).length === 0) return { ok: true };

    if (data.availableFrom && data.availableTo && data.availableFrom > data.availableTo) {
      return { ok: false, error: "Available from must be before available to." };
    }

    await prisma.reserve.update({
      where: { id: input.reserveId },
      data,
    });
    return { ok: true };
  } catch (e) {
    console.error("UpdateReserve error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update reserve.",
    };
  }
}

export async function deleteReserve(reserveId: string): Promise<ManageReserveResult> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageLibrary(ctx.role)) {
    return { ok: false, error: "Insufficient role to manage reserves." };
  }

  try {
    const existing = await prisma.reserve.findFirst({
      where: {
        id: reserveId,
        resource: { tenantId: ctx.tenantId },
      },
    });
    if (!existing) return { ok: false, error: "Reserve not found." };

    await prisma.reserve.delete({ where: { id: reserveId } });
    return { ok: true };
  } catch (e) {
    console.error("DeleteReserve error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to delete reserve.",
    };
  }
}

// ---------------------------------------------------------------------------
// Reading lists for programme (for reading-list page)
// ---------------------------------------------------------------------------

export type ReadingListSummary = {
  id: string;
  name: string;
  moduleId: string | null;
  moduleTitle: string | null;
  items: { id: string; resourceId: string; resourceTitle: string; required: boolean }[];
};

export type GetProgrammeReadingListsResult =
  | { ok: true; lists: ReadingListSummary[] }
  | { ok: false; error: string };

export async function getProgrammeReadingLists(
  programmeId: string
): Promise<GetProgrammeReadingListsResult> {
  const ctx = await requireTenant();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  try {
    const programme = await prisma.programme.findFirst({
      where: { id: programmeId, department: { tenantId: ctx.tenantId } },
    });
    if (!programme) return { ok: false, error: "Programme not found." };

    const lists = await prisma.readingList.findMany({
      where: { programmeId },
      include: {
        module: { select: { id: true, title: true } },
        items: {
          include: { resource: { select: { id: true, title: true } } },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    const summaries: ReadingListSummary[] = lists.map((l) => ({
      id: l.id,
      name: l.name,
      moduleId: l.moduleId,
      moduleTitle: l.module?.title ?? null,
      items: l.items.map((i) => ({
        id: i.id,
        resourceId: i.resourceId,
        resourceTitle: i.resource.title,
        required: i.required,
      })),
    }));
    return { ok: true, lists: summaries };
  } catch (e) {
    console.error("GetProgrammeReadingLists error:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to load reading lists.",
    };
  }
}
