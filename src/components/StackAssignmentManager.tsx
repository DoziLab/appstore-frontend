import React, { useState } from 'react';
import { Users, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { KeycloakUser } from '../api/keycloak';

export interface StackAssignment {
  stackId: string;
  stackName: string;
  assignedStudents: KeycloakUser[];
}

interface StackAssignmentManagerProps {
  students: KeycloakUser[];
  stacks: StackAssignment[];
  onStacksChange: (stacks: StackAssignment[]) => void;
}

export function StackAssignmentManager({
  students,
  stacks,
  onStacksChange,
}: StackAssignmentManagerProps) {
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

  const addStack = () => {
    const newStack: StackAssignment = {
      stackId: `stack-${Date.now()}`,
      stackName: `Stack ${stacks.length + 1}`,
      assignedStudents: [],
    };
    onStacksChange([...stacks, newStack]);
    // Auto-expand new stack
    setExpandedStacks(new Set([...expandedStacks, newStack.stackId]));
  };

  const removeStack = (stackId: string) => {
    onStacksChange(stacks.filter((s) => s.stackId !== stackId));
    const newExpanded = new Set(expandedStacks);
    newExpanded.delete(stackId);
    setExpandedStacks(newExpanded);
  };

  const renameStack = (stackId: string, newName: string) => {
    onStacksChange(
      stacks.map((s) =>
        s.stackId === stackId ? { ...s, stackName: newName } : s
      )
    );
  };

  const addStudentToStack = (stackId: string, student: KeycloakUser) => {
    onStacksChange(
      stacks.map((s) =>
        s.stackId === stackId
          ? { ...s, assignedStudents: [...s.assignedStudents, student] }
          : s
      )
    );
  };

  const removeStudentFromStack = (stackId: string, studentId: string) => {
    onStacksChange(
      stacks.map((s) =>
        s.stackId === stackId
          ? {
              ...s,
              assignedStudents: s.assignedStudents.filter(
                (st) => st.id !== studentId
              ),
            }
          : s
      )
    );
  };

  const autoDistribute = () => {
    const numStacks = stacks.length;
    if (numStacks === 0 || students.length === 0) return;

    const studentsPerStack = Math.ceil(students.length / numStacks);
    const newStacks = stacks.map((stack, index) => ({
      ...stack,
      assignedStudents: students.slice(
        index * studentsPerStack,
        (index + 1) * studentsPerStack
      ),
    }));

    onStacksChange(newStacks);
  };

  // Get students not assigned to any stack
  const assignedStudentIds = new Set(
    stacks.flatMap((s) => s.assignedStudents.map((st) => st.id))
  );
  const unassignedStudents = students.filter(
    (s) => !assignedStudentIds.has(s.id)
  );

  const getStudentDisplayName = (student: KeycloakUser): string => {
    if (student.firstName && student.lastName) {
      return `${student.firstName} ${student.lastName}`;
    }
    if (student.username) return student.username;
    if (student.email) return student.email;
    return student.id.slice(0, 8);
  };

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium">Stack-Zuweisung</Label>
          <p className="text-xs text-slate-500 mt-1">
            Verteilen Sie {students.length} Studenten auf {stacks.length} Stack
            {stacks.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {stacks.length > 0 && students.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={autoDistribute}
            >
              <Users className="w-4 h-4 mr-2" />
              Auto-Verteilen
            </Button>
          )}
          <Button
            type="button"
            onClick={addStack}
            size="sm"
            className="bg-teal-500 hover:bg-teal-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Stack hinzufügen
          </Button>
        </div>
      </div>

      {/* Unassigned students pool */}
      {unassignedStudents.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600" />
              Nicht zugewiesene Studenten ({unassignedStudents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {unassignedStudents.map((student) => (
                <Badge
                  key={student.id}
                  variant="outline"
                  className="bg-white border-amber-300 text-amber-900"
                >
                  {getStudentDisplayName(student)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stacks */}
      {stacks.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="pt-6 text-center text-slate-500">
            <p className="text-sm">Keine Stacks vorhanden</p>
            <p className="text-xs mt-1">
              Klicken Sie auf "Stack hinzufügen" um zu beginnen
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {stacks.map((stack) => {
            const isExpanded = expandedStacks.has(stack.stackId);
            const availableStudents = students.filter(
              (s) =>
                !stack.assignedStudents.some((as) => as.id === s.id) &&
                !assignedStudentIds.has(s.id)
            );

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
                      <Input
                        value={stack.stackName}
                        onChange={(e) =>
                          renameStack(stack.stackId, e.target.value)
                        }
                        className="text-sm font-medium border-0 focus-visible:ring-0 px-0"
                      />
                      <Badge variant="secondary" className="text-xs">
                        {stack.assignedStudents.length} Student
                        {stack.assignedStudents.length !== 1 ? 'en' : ''}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStack(stack.stackId)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="space-y-3">
                    {/* Assigned students */}
                    {stack.assignedStudents.length > 0 && (
                      <div>
                        <Label className="text-xs text-slate-600 mb-2 block">
                          Zugewiesene Studenten
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {stack.assignedStudents.map((student) => (
                            <Badge
                              key={student.id}
                              variant="secondary"
                              className="bg-teal-50 text-teal-700 border-teal-200 flex items-center gap-1"
                            >
                              {getStudentDisplayName(student)}
                              <button
                                type="button"
                                onClick={() =>
                                  removeStudentFromStack(stack.stackId, student.id)
                                }
                                className="ml-1 hover:text-red-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Available students to add */}
                    {unassignedStudents.length > 0 && (
                      <div>
                        <Label className="text-xs text-slate-600 mb-2 block">
                          Student hinzufügen
                        </Label>
                        <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50">
                          {unassignedStudents.map((student) => (
                            <button
                              key={student.id}
                              type="button"
                              onClick={() =>
                                addStudentToStack(stack.stackId, student)
                              }
                              className="w-full text-left px-2 py-1.5 text-sm hover:bg-white rounded flex items-center justify-between group"
                            >
                              <span>{getStudentDisplayName(student)}</span>
                              <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 text-teal-600" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {stack.assignedStudents.length === 0 && (
                      <p className="text-xs text-slate-500 text-center py-4">
                        Keine Studenten zugewiesen
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
