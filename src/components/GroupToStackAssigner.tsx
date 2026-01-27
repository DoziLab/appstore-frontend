import React, { useState } from 'react';
import { Server, Plus, X, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Label } from './ui/label';

export interface StudentGroup {
  groupId: string;
  groupName: string;
  students: any[];
}

export interface GroupStackAssignment {
  stackId: string;
  stackName: string;
  assignedGroups: StudentGroup[];
}

interface GroupToStackAssignerProps {
  groups: StudentGroup[];
  stacks: GroupStackAssignment[];
  onStacksChange: (stacks: GroupStackAssignment[]) => void;
}

export function GroupToStackAssigner({
  groups,
  stacks,
  onStacksChange,
}: GroupToStackAssignerProps) {
  const [expandedStacks, setExpandedStacks] = useState<Set<string>>(new Set());

  const toggleStackExpanded = (stackId: string) => {
    const newExpanded = new Set(expandedStacks);
    if (newExpanded.has(stackId)) {
      newExpanded.delete(stackId);
    } else {
      newExpanded.add(stackId);
    }
    setExpandedStacks(newExpanded);
  };

  const addGroupToStack = (stackId: string, group: StudentGroup) => {
    onStacksChange(
      stacks.map((s) =>
        s.stackId === stackId
          ? { ...s, assignedGroups: [...s.assignedGroups, group] }
          : s
      )
    );
  };

  const removeGroupFromStack = (stackId: string, groupId: string) => {
    onStacksChange(
      stacks.map((s) =>
        s.stackId === stackId
          ? {
              ...s,
              assignedGroups: s.assignedGroups.filter(
                (g) => g.groupId !== groupId
              ),
            }
          : s
      )
    );
  };

  const autoDistribute = () => {
    const numStacks = stacks.length;
    if (numStacks === 0 || groups.length === 0) return;

    const groupsPerStack = Math.ceil(groups.length / numStacks);
    const newStacks = stacks.map((stack, index) => ({
      ...stack,
      assignedGroups: groups.slice(
        index * groupsPerStack,
        (index + 1) * groupsPerStack
      ),
    }));

    onStacksChange(newStacks);
  };

  const assignedGroupIds = new Set(
    stacks.flatMap((s) => s.assignedGroups.map((g) => g.groupId))
  );
  const unassignedGroups = groups.filter(
    (g) => !assignedGroupIds.has(g.groupId)
  );

  const getTotalStudentsInStack = (stack: GroupStackAssignment): number => {
    return stack.assignedGroups.reduce(
      (sum, group) => sum + group.students.length,
      0
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium">Stack-Zuweisung</Label>
          <p className="text-xs text-slate-500 mt-1">
            Verteilen Sie {groups.length} Gruppe{groups.length !== 1 ? 'n' : ''} auf {stacks.length} Stack{stacks.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {stacks.length > 0 && groups.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={autoDistribute}
            >
              <Server className="w-4 h-4 mr-2" />
              Auto-Verteilen
            </Button>
          )}
        </div>
      </div>

      {unassignedGroups.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Server className="w-4 h-4 text-amber-600" />
              Nicht zugewiesene Gruppen ({unassignedGroups.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {unassignedGroups.map((group) => (
                <Badge
                  key={group.groupId}
                  variant="outline"
                  className="bg-white border-amber-300 text-amber-900"
                >
                  {group.groupName} ({group.students.length})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stacks.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="pt-6 text-center text-slate-500">
            <p className="text-sm">Keine Stacks vorhanden</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {stacks.map((stack) => {
            const isExpanded = expandedStacks.has(stack.stackId);
            const totalStudents = getTotalStudentsInStack(stack);

            return (
              <Card key={stack.stackId} className="border-slate-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleStackExpanded(stack.stackId)}
                        className="p-1 h-auto"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                      <Server className="w-4 h-4 text-slate-600" />
                      <span className="text-sm font-medium">{stack.stackName}</span>
                      <Badge variant="secondary" className="text-xs">
                        {stack.assignedGroups.length} Gruppe
                        {stack.assignedGroups.length !== 1 ? 'n' : ''}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {totalStudents} Student
                        {totalStudents !== 1 ? 'en' : ''}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="space-y-3">
                    {stack.assignedGroups.length > 0 && (
                      <div>
                        <Label className="text-xs text-slate-600 mb-2 block">
                          Zugewiesene Gruppen
                        </Label>
                        <div className="space-y-2">
                          {stack.assignedGroups.map((group) => (
                            <div
                              key={group.groupId}
                              className="flex items-center justify-between p-2 bg-teal-50 border border-teal-200 rounded"
                            >
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  {group.groupName}
                                </Badge>
                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                <span className="text-xs text-slate-600">
                                  {group.students.length} Student
                                  {group.students.length !== 1 ? 'en' : ''}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  removeGroupFromStack(stack.stackId, group.groupId)
                                }
                                className="text-red-600 hover:text-red-700"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {unassignedGroups.length > 0 && (
                      <div>
                        <Label className="text-xs text-slate-600 mb-2 block">
                          Gruppe hinzufügen
                        </Label>
                        <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50">
                          {unassignedGroups.map((group) => (
                            <button
                              key={group.groupId}
                              type="button"
                              onClick={() =>
                                addGroupToStack(stack.stackId, group)
                              }
                              className="w-full text-left px-2 py-1.5 text-sm hover:bg-white rounded flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-2">
                                <span>{group.groupName}</span>
                                <Badge variant="outline" className="text-xs">
                                  {group.students.length}
                                </Badge>
                              </div>
                              <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 text-teal-600" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {stack.assignedGroups.length === 0 && (
                      <p className="text-xs text-slate-500 text-center py-4">
                        Keine Gruppen zugewiesen
                      </p>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
