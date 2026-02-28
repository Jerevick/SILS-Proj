"use client";

/**
 * Courses list — search, filters, DataGrid. Tenant-scoped.
 */

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ThemeProvider } from "@mui/material/styles";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import InputAdornment from "@mui/material/InputAdornment";
import { Search, Plus, Sparkles } from "lucide-react";
import { DashboardDataGrid } from "@/components/dashboard/dashboard-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import type { CourseListItem } from "@/app/api/courses/route";
import { COURSES_QUERY_KEY } from "@/lib/courses-query";
import { createTheme } from "@mui/material/styles";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#00f5ff" },
    background: { default: "#030014", paper: "rgba(15, 15, 35, 0.6)" },
  },
  typography: { fontFamily: "var(--font-display), system-ui, sans-serif" },
});

async function fetchCourses(params: {
  search?: string;
  published?: string;
  mode?: string;
}): Promise<CourseListItem[]> {
  const sp = new URLSearchParams();
  if (params.search) sp.set("search", params.search);
  if (params.published) sp.set("published", params.published);
  if (params.mode) sp.set("mode", params.mode);
  const res = await fetch(`/api/courses?${sp.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch courses");
  return res.json();
}

type Row = CourseListItem & { id: string };

export default function CoursesPage() {
  const [search, setSearch] = useState("");
  const [publishedFilter, setPublishedFilter] = useState<string>("");
  const [modeFilter, setModeFilter] = useState<string>("");

  const { data: courses = [], isLoading } = useQuery({
    queryKey: [
      ...COURSES_QUERY_KEY,
      search || null,
      publishedFilter || null,
      modeFilter || null,
    ],
    queryFn: () =>
      fetchCourses({
        search: search || undefined,
        published: publishedFilter || undefined,
        mode: modeFilter || undefined,
      }),
  });

  const rows: Row[] = courses.map((c) => ({ ...c, id: c.id }));

  const columns: GridColDef<Row>[] = [
    {
      field: "title",
      headerName: "Title",
      flex: 1,
      minWidth: 200,
      renderCell: (params) => (
        <Link
          href={`/courses/${params.row.id}`}
          className="text-neon-cyan hover:underline font-medium"
        >
          {params.value}
        </Link>
      ),
    },
    { field: "slug", headerName: "Slug", width: 140 },
    {
      field: "mode",
      headerName: "Mode",
      width: 100,
    },
    {
      field: "published",
      headerName: "Published",
      width: 100,
      renderCell: (params) => (params.value ? "Yes" : "Draft"),
    },
    {
      field: "modules",
      headerName: "Modules",
      width: 90,
      valueGetter: (_, row) => row._count?.modules ?? 0,
    },
    {
      field: "updatedAt",
      headerName: "Updated",
      width: 110,
      valueFormatter: (value: string) =>
        value ? new Date(value).toLocaleDateString() : "",
    },
  ];

  return (
    <ThemeProvider theme={darkTheme}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <Box
            component="form"
            noValidate
            sx={{ "& .MuiTextField-root": { m: 0 } }}
            className="flex flex-wrap items-center gap-3"
          >
            <TextField
              size="small"
              placeholder="Search courses…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search className="w-4 h-4 text-slate-400" />
                  </InputAdornment>
                ),
              }}
              sx={{
                width: 240,
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "rgba(15,23,42,0.8)",
                  color: "rgba(226,232,240,0.9)",
                  "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
                },
              }}
            />
            <TextField
              size="small"
              select
              label="Published"
              value={publishedFilter}
              onChange={(e) => setPublishedFilter(e.target.value)}
              sx={{
                minWidth: 120,
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "rgba(15,23,42,0.8)",
                  color: "rgba(226,232,240,0.9)",
                  "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
                },
                "& .MuiInputLabel-root": { color: "rgba(226,232,240,0.7)" },
              }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Published</MenuItem>
              <MenuItem value="false">Draft</MenuItem>
            </TextField>
            <TextField
              size="small"
              select
              label="Mode"
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              sx={{
                minWidth: 120,
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "rgba(15,23,42,0.8)",
                  color: "rgba(226,232,240,0.9)",
                  "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
                },
                "& .MuiInputLabel-root": { color: "rgba(226,232,240,0.7)" },
              }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="SYNC">Sync</MenuItem>
              <MenuItem value="ASYNC">Async</MenuItem>
            </TextField>
          </Box>
          <div className="flex gap-2 ml-auto">
            <Link
              href="/courses/new"
              className="inline-flex items-center gap-2 rounded-lg bg-neon-cyan/20 px-4 py-2 text-sm font-medium text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New course
            </Link>
            <Link
              href="/courses/new?autobuild=1"
              className="inline-flex items-center gap-2 rounded-lg bg-neon-purple/20 px-4 py-2 text-sm font-medium text-neon-purple border border-neon-purple/50 hover:bg-neon-purple/30 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              AI build
            </Link>
          </div>
        </div>

        <DashboardDataGrid<Row>
          columns={columns}
          rows={rows}
          getRowId={(row) => row.id}
          title={undefined}
          pageSize={10}
        />

        {isLoading && (
          <p className="text-slate-400 text-sm">Loading courses…</p>
        )}
      </div>
    </ThemeProvider>
  );
}
