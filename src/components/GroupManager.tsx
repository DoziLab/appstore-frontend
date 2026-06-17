import React, { useState, useEffect } from 'react';
import { Users, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { KeycloakUser } from '../api/keycloak';

export interface StudentGroup {
  groupId: string;
  groupName: string;
  students: KeycloakUser[];
}

interface GroupManagerProps {
  students: KeycloakUser[];
  groups: StudentGroup[];
  onGroupsChange: (groups: StudentGroup[]) => void;
}

export function GroupManager({
  students,
  groups,
  onGroupsChange,
}: GroupManagerProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Initialize all groups as expanded
  useEffect(() => {
    const allGroupIds = new Set(groups.map(g => g.groupId));
    setExpandedGroups(allGroupIds);
  }, [groups.length]); // Only update when number of groups changes

  const toggleGroupExpanded = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const addGroup = () => {
    const newGroup: StudentGroup = {
      groupId: `group-${Date.now()}`,
      groupName: `Gruppe ${groups.length + 1}`,
      students: [],
    };
    onGroupsChange([...groups, newGroup]);
    setExpandedGroups(new Set([...expandedGroups, newGroup.groupId]));
  };

  const removeGroup = (groupId: string) => {
    onGroupsChange(groups.filter((g) => g.groupId !== groupId));
    const newExpanded = new Set(expandedGroups);
    newExpanded.delete(groupId);
    setExpandedGroups(newExpanded);
  };

  const renameGroup = (groupId: string, newName: string) => {
    onGroupsChange(
      groups.map((g) =>
        g.groupId === groupId ? { ...g, groupName: newName } : g
      )
    );
  };

  const addStudentToGroup = (groupId: string, student: KeycloakUser) => {
    onGroupsChange(
      groups.map((g) =>
        g.groupId === groupId
          ? { ...g, students: [...g.students, student] }
          : g
      )
    );
  };

  const removeStudentFromGroup = (groupId: string, studentId: string) => {
    onGroupsChange(
      groups.map((g) =>
        g.groupId === groupId
          ? {
              ...g,
              students: g.students.filter((st) => st.id !== studentId),
            }
          : g
      )
    );
  };

  const autoDistribute = () => {
    const numGroups = groups.length;
    if (numGroups === 0 || students.length === 0) return;

    const studentsPerGroup = Math.ceil(students.length / numGroups);
    const newGroups = groups.map((group, index) => ({
      ...group,
      students: students.slice(
        index * studentsPerGroup,
        (index + 1) * studentsPerGroup
      ),
    }));

    onGroupsChange(newGroups);
  };

  const assignedStudentIds = new Set(
    groups.flatMap((g) => g.students.map((st) => st.id))
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
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-medium">Gruppenverwaltung</Label>
          <p className="text-xs text-slate-500 mt-1">
            Verteilen Sie {students.length} Studenten auf {groups.length} Gruppe{groups.length !== 1 ? 'n' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {groups.length > 0 && students.length > 0 && (
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
            onClick={addGroup}
            size="sm"
            className="bg-teal-500 hover:bg-teal-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Gruppe hinzufügen
          </Button>
        </div>
      </div>

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

      {groups.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="pt-6 text-center text-slate-500">
            <p className="text-sm">Keine Gruppen vorhanden</p>
            <p className="text-xs mt-1">
              Klicken Sie auf "Gruppe hinzufügen" um zu beginnen
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.groupId);

            return (
              <Card key={group.groupId} className="border-slate-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleGroupExpanded(group.groupId)}
                        className="p-1 h-auto"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                      <Input
                        value={group.groupName}
                        onChange={(e) =>
                          renameGroup(group.groupId, e.target.value)
                        }
                        className="text-sm font-medium border-0 focus-visible:ring-0 px-0"
                      />
                      <Badge variant="secondary" className="text-xs">
                        {group.students.length} Student
                        {group.students.length !== 1 ? 'en' : ''}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeGroup(group.groupId)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="space-y-3">
                    {group.students.length > 0 && (
                      <div>
                        <Label className="text-xs text-slate-600 mb-2 block">
                          Zugewiesene Studenten
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {group.students.map((student) => (
                            <Badge
                              key={student.id}
                              variant="secondary"
                              className="bg-teal-50 text-teal-700 border-teal-200 flex items-center gap-1"
                            >
                              {getStudentDisplayName(student)}
                              <button
                                type="button"
                                onClick={() =>
                                  removeStudentFromGroup(group.groupId, student.id)
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
                                addStudentToGroup(group.groupId, student)
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

                    {group.students.length === 0 && (
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
