"use client";

/**
 * Phase 24: Leave requests management — submit, approve, track.
 * Faculty can request leave; HR Admin / Dean / HoD can approve or reject with notification.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calendar, Send, Check, X, Loader2, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DashboardDataGrid } from "@/components/dashboard/dashboard-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import {
  listFacultyLeaves,
  requestLeave,
  approveLeave,
  type FacultyLeaveListItem,
  type RequestLeaveInput,
  type ListLeavesFilters,
} from "@/app/actions/hr-faculty-actions";
import type { FacultyLeaveStatus, FacultyLeaveType } from "@prisma/client";

type Row = FacultyLeaveListItem & { id: string };

const LEAVE_TYPES: { value: FacultyLeaveType; label: string }[] = [
  { value: "ANNUAL", label: "Annual" },
  { value: "SICK", label: "Sick" },
  { value: "STUDY", label: "Study" },
  { value: "PARENTAL", label: "Parental" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "OTHER", label: "Other" },
];

function facultyDisplay(f: FacultyLeaveListItem["faculty"]) {
  const first = f.user.firstName ?? "";
  const last = f.user.lastName ?? "";
  return first || last ? `${first} ${last}`.trim() : f.employeeId;
}

export default function HrLeavesPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState<RequestLeaveInput>({
    leaveType: "ANNUAL",
    startDate: "",
    endDate: "",
    notes: "",
  });
  const [approveModal, setApproveModal] = useState<{
    leave: FacultyLeaveListItem;
    approved: boolean;
  } | null>(null);
  const [approveNotes, setApproveNotes] = useState("");

  const filters: ListLeavesFilters = {};
  if (statusFilter && statusFilter !== "all") filters.status = statusFilter as FacultyLeaveStatus;

  const { data, isLoading, error } = useQuery({
    queryKey: ["hr-leaves", filters],
    queryFn: async () => {
      const r = await listFacultyLeaves(Object.keys(filters).length ? filters : undefined);
      if (!r.ok) throw new Error(r.error);
      return r;
    },
  });

  const requestMutation = useMutation({
    mutationFn: (input: RequestLeaveInput) => requestLeave(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-leaves"] });
      setRequestOpen(false);
      setRequestForm({ leaveType: "ANNUAL", startDate: "", endDate: "", notes: "" });
      toast.success("Leave request submitted.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to submit"),
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!approveModal) return;
      const r = await approveLeave(approveModal.leave.id, approveModal.approved, approveNotes || undefined);
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-leaves"] });
      setApproveModal(null);
      setApproveNotes("");
      toast.success(approveModal?.approved ? "Leave approved." : "Leave rejected.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update"),
  });

  const leaves = data?.leaves ?? [];
  const rows: Row[] = leaves.map((l) => ({ ...l, id: l.id }));

  const columns: GridColDef<Row>[] = [
    {
      field: "faculty",
      headerName: "Faculty",
      flex: 1,
      minWidth: 160,
      valueGetter: (_, row) => facultyDisplay(row.faculty),
    },
    {
      field: "leaveType",
      headerName: "Type",
      width: 100,
      valueFormatter: (v) => (v ? String(v).replace(/_/g, " ") : ""),
    },
    {
      field: "startDate",
      headerName: "Start",
      width: 110,
    },
    {
      field: "endDate",
      headerName: "End",
      width: 110,
    },
    {
      field: "status",
      headerName: "Status",
      width: 100,
      renderCell: (params) => {
        const s = params.value as string;
        const color =
          s === "APPROVED" ? "text-green-400" : s === "REJECTED" ? "text-red-400" : "text-amber-400";
        return <span className={color}>{s}</span>;
      },
    },
    {
      field: "createdAt",
      headerName: "Requested",
      width: 110,
      valueFormatter: (v) => (v ? new Date(v as string).toLocaleDateString() : ""),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 140,
      sortable: false,
      renderCell: (params) => {
        if (params.row.status !== "PENDING") return null;
        return (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="border-green-500/50 text-green-400 hover:bg-green-500/10"
              onClick={() => setApproveModal({ leave: params.row, approved: true })}
            >
              <Check className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
              onClick={() => setApproveModal({ leave: params.row, approved: false })}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  const handleSubmitRequest = () => {
    if (!requestForm.startDate || !requestForm.endDate) {
      toast.error("Enter start and end date.");
      return;
    }
    if (new Date(requestForm.startDate) > new Date(requestForm.endDate)) {
      toast.error("End date must be on or after start date.");
      return;
    }
    requestMutation.mutate(requestForm);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="h-7 w-7 text-neon-cyan" />
            Leave requests
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Submit a leave request or approve pending requests. Approvers receive in-app notifications.
          </p>
        </div>
        <Button
          className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim"
          onClick={() => setRequestOpen(true)}
        >
          <Send className="h-4 w-4 mr-2" />
          Request leave
        </Button>
      </div>

      <Card className="border-white/10 bg-space-800/50">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
            <Filter className="h-4 w-4 text-neon-cyan" />
            Filters
          </CardTitle>
          <Select
            value={statusFilter || "all"}
            onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[140px] border-white/20 bg-space-900 text-slate-200">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="text-amber-400 text-sm py-4">{(error as Error).message}</p>
          )}
          {isLoading && (
            <p className="text-slate-400 py-8">Loading leave requests…</p>
          )}
          {!isLoading && !error && leaves.length === 0 && (
            <div className="py-12 text-center text-slate-500">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No leave requests found.</p>
            </div>
          )}
          {!isLoading && !error && leaves.length > 0 && (
            <DashboardDataGrid<Row>
              columns={columns}
              rows={rows}
              getRowId={(row) => row.id}
              pageSize={10}
            />
          )}
        </CardContent>
      </Card>

      {/* Request leave dialog */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="bg-space-800 border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Request leave</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-slate-400">Leave type</Label>
              <Select
                value={requestForm.leaveType}
                onValueChange={(v) =>
                  setRequestForm((p) => ({ ...p, leaveType: v as FacultyLeaveType }))
                }
              >
                <SelectTrigger className="mt-1 border-white/20 bg-space-900 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-400">Start date</Label>
              <Input
                type="date"
                className="mt-1 border-white/20 bg-space-900 text-slate-200"
                value={requestForm.startDate}
                onChange={(e) => setRequestForm((p) => ({ ...p, startDate: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-slate-400">End date</Label>
              <Input
                type="date"
                className="mt-1 border-white/20 bg-space-900 text-slate-200"
                value={requestForm.endDate}
                onChange={(e) => setRequestForm((p) => ({ ...p, endDate: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-slate-400">Notes (optional)</Label>
              <Textarea
                className="mt-1 border-white/20 bg-space-900 text-slate-200 min-h-[80px]"
                value={requestForm.notes ?? ""}
                onChange={(e) => setRequestForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Reason or details…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRequestOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-neon-cyan text-space-900 hover:bg-neon-cyanDim"
              onClick={handleSubmitRequest}
              disabled={requestMutation.isPending}
            >
              {requestMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve / Reject dialog */}
      <Dialog
        open={!!approveModal}
        onOpenChange={(open) => !open && setApproveModal(null)}
      >
        <DialogContent className="bg-space-800 border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>
              {approveModal?.approved ? "Approve" : "Reject"} leave request
            </DialogTitle>
          </DialogHeader>
          {approveModal && (
            <>
              <p className="text-slate-400 text-sm">
                {facultyDisplay(approveModal.leave.faculty)} — {approveModal.leave.leaveType.replace(/_/g, " ")} —{" "}
                {approveModal.leave.startDate} to {approveModal.leave.endDate}
              </p>
              <div className="pt-2">
                <Label className="text-slate-400">Notes (optional)</Label>
                <Textarea
                  className="mt-1 border-white/20 bg-space-900 text-slate-200 min-h-[60px]"
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  placeholder="Reason or comment…"
                />
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApproveModal(null)}>
              Cancel
            </Button>
            <Button
              className={
                approveModal?.approved
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-red-600 text-white hover:bg-red-700"
              }
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {approveModal?.approved ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
