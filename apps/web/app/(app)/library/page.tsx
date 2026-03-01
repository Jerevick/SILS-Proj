"use client";

/**
 * Phase 23: Library search — modern search interface with filters (type, availability, course relevance).
 * Uses TanStack Query and MUI DataGrid.
 */

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ThemeProvider } from "@mui/material/styles";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import InputAdornment from "@mui/material/InputAdornment";
import { Search, BookOpen, ExternalLink } from "lucide-react";
import { DashboardDataGrid } from "@/components/dashboard/dashboard-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { librarySearch, type LibrarySearchFilters, type LibraryResourceItem } from "@/app/actions/library-actions";
import { librarySearchKey } from "@/lib/query-keys";
import { createTheme } from "@mui/material/styles";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#00f5ff" },
    background: { default: "#030014", paper: "rgba(15, 15, 35, 0.6)" },
  },
  typography: { fontFamily: "var(--font-display), system-ui, sans-serif" },
});

type Row = LibraryResourceItem & { id: string };

export default function LibraryPage() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [accessFilter, setAccessFilter] = useState<string>("");
  const [availabilityFilter, setAvailabilityFilter] = useState<"available" | "all">("all");
  const [searchSubmitted, setSearchSubmitted] = useState("");

  const filters: LibrarySearchFilters = {
    type: typeFilter as LibraryResourceItem["type"] | "",
    accessLevel: accessFilter as LibraryResourceItem["accessLevel"] | "",
    availability: availabilityFilter,
  };

  const { data, isLoading } = useQuery({
    queryKey: librarySearchKey(searchSubmitted || null, filters),
    queryFn: async () => {
      const result = await librarySearch({ query: searchSubmitted || undefined, filters });
      if (!result.ok) throw new Error(result.error);
      return result;
    },
  });

  const resources = data?.ok ? data.resources : [];
  const externalStub = data?.ok ? data.externalStub : [];
  const rows: Row[] = resources.map((r) => ({ ...r, id: r.id }));

  const columns: GridColDef<Row>[] = [
    {
      field: "title",
      headerName: "Title",
      flex: 1,
      minWidth: 220,
      renderCell: (params) => (
        <span className="font-medium text-slate-100">{params.value}</span>
      ),
    },
    {
      field: "author",
      headerName: "Author",
      width: 160,
      valueGetter: (_, row) => row.author ?? "—",
    },
    {
      field: "type",
      headerName: "Type",
      width: 100,
      valueFormatter: (v) => (v ? String(v) : ""),
    },
    {
      field: "accessLevel",
      headerName: "Access",
      width: 100,
    },
    {
      field: "availableCopies",
      headerName: "Copies",
      width: 90,
      type: "number",
    },
    {
      field: "url",
      headerName: "Link",
      width: 80,
      renderCell: (params) =>
        params.value ? (
          <a
            href={params.value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neon-cyan hover:underline inline-flex items-center gap-1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open
          </a>
        ) : (
          "—"
        ),
    },
  ];

  const handleSearch = () => setSearchSubmitted(query);

  return (
    <ThemeProvider theme={darkTheme}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-neon-cyan" />
            Library
          </h1>
          <Link
            href="/library/reserves"
            className="ml-auto text-slate-400 hover:text-white text-sm"
          >
            Reserves →
          </Link>
        </div>

        <Box
          component="form"
          onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
          className="flex flex-wrap items-center gap-3"
          sx={{ "& .MuiTextField-root": { m: 0 } }}
        >
          <TextField
            size="small"
            placeholder="Search by title, author, ISBN…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search className="w-4 h-4 text-slate-400" />
                </InputAdornment>
              ),
            }}
            sx={{
              width: 280,
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
            label="Type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
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
            <MenuItem value="book">Book</MenuItem>
            <MenuItem value="article">Article</MenuItem>
            <MenuItem value="video">Video</MenuItem>
            <MenuItem value="eBook">eBook</MenuItem>
          </TextField>
          <TextField
            size="small"
            select
            label="Access"
            value={accessFilter}
            onChange={(e) => setAccessFilter(e.target.value)}
            sx={{
              minWidth: 110,
              "& .MuiOutlinedInput-root": {
                backgroundColor: "rgba(15,23,42,0.8)",
                color: "rgba(226,232,240,0.9)",
                "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
              },
              "& .MuiInputLabel-root": { color: "rgba(226,232,240,0.7)" },
            }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="OPEN">Open</MenuItem>
            <MenuItem value="COURSE">Course</MenuItem>
            <MenuItem value="RESERVE">Reserve</MenuItem>
          </TextField>
          <TextField
            size="small"
            select
            label="Availability"
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value as "available" | "all")}
            sx={{
              minWidth: 130,
              "& .MuiOutlinedInput-root": {
                backgroundColor: "rgba(15,23,42,0.8)",
                color: "rgba(226,232,240,0.9)",
                "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
              },
              "& .MuiInputLabel-root": { color: "rgba(226,232,240,0.7)" },
            }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="available">Available only</MenuItem>
          </TextField>
          <button
            type="button"
            onClick={handleSearch}
            className="rounded-lg bg-neon-cyan/20 px-4 py-2 text-sm font-medium text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/30"
          >
            Search
          </button>
        </Box>

        <DashboardDataGrid<Row>
          columns={columns}
          rows={rows}
          getRowId={(row) => row.id}
          title={undefined}
          pageSize={10}
        />

        {externalStub && externalStub.length > 0 && (
          <div className="glass rounded-xl border border-white/5 p-4">
            <h2 className="font-display text-lg font-semibold text-white mb-2">
              External catalog (stub)
            </h2>
            <ul className="space-y-2 text-slate-300 text-sm">
              {externalStub.map((ext) => (
                <li key={ext.externalId} className="flex items-center gap-2">
                  <span>{ext.title}</span>
                  {ext.author && <span className="text-slate-500">— {ext.author}</span>}
                  {ext.url && (
                    <a
                      href={ext.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neon-cyan hover:underline"
                    >
                      Open
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {isLoading && (
          <p className="text-slate-400 text-sm">Searching…</p>
        )}
      </div>
    </ThemeProvider>
  );
}
