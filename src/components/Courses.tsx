import { BookOpen, Users, Server, ChevronRight, Trash2, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Check } from 'lucide-react';

// Mock-Daten für Studenten (S-Nummern)
const mockStudents = [
  's232765', 's232567', 's232728', 's233456', 's233789',
  's234012', 's234567', 's235123', 's235678', 's236234',
  's236789', 's237012', 's237456', 's238123', 's238567',
  's239012', 's239456', 's240123', 's240567', 's241012',
];

type Course = {
  code: string;
  name: string;
  students: number;
  studentIds: string[];
  applications: {
    name: string;
    status: string;
    users: number;
  }[];
};

export function Courses() {
  const [courses, setCourses] = useState<Course[]>([
    {
      code: 'CS101',
      name: 'Informatik 101',
      students: 45,
      studentIds: ['s232765', 's232567', 's232728'],
      applications: [
        { name: 'Jupyter Notebook', status: 'running', users: 42 },
        { name: 'Python Entwicklungsumgebung', status: 'running', users: 38 },
      ],
    },
    {
      code: 'CS202',
      name: 'Software Engineering',
      students: 32,
      studentIds: ['s233456', 's233789', 's234012'],
      applications: [
        { name: 'GitLab Server', status: 'running', users: 30 },
        { name: 'Jenkins CI/CD', status: 'running', users: 28 },
        { name: 'Entwicklungs-VMs', status: 'running', users: 32 },
      ],
    },
    {
      code: 'CS305',
      name: 'Cloud Computing',
      students: 28,
      studentIds: ['s234567', 's235123', 's235678'],
      applications: [
        { name: 'Kubernetes Cluster', status: 'deploying', users: 0 },
        { name: 'Docker Registry', status: 'running', users: 24 },
      ],
    },
    {
      code: 'CS410',
      name: 'Cybersicherheit',
      students: 35,
      studentIds: ['s236234', 's236789', 's237012'],
      applications: [
        { name: 'Pentest Laborumgebung', status: 'running', users: 28 },
        { name: 'Verwundbare VMs', status: 'running', users: 31 },
        { name: 'Netzwerkanalyse-Tools', status: 'running', users: 26 },
      ],
    },
    {
      code: 'CS150',
      name: 'Einführung in die Programmierung',
      students: 52,
      studentIds: ['s237456', 's238123', 's238567'],
      applications: [
        { name: 'Entwicklungs-VM', status: 'stopped', users: 0 },
      ],
    },
    {
      code: 'CS310',
      name: 'Datenbanksysteme',
      students: 38,
      studentIds: ['s239012', 's239456', 's240123'],
      applications: [
        { name: 'PostgreSQL Cluster', status: 'running', users: 35 },
        { name: 'MongoDB Instanz', status: 'running', users: 30 },
        { name: 'Redis Cache', status: 'running', users: 22 },
      ],
    },
  ]);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCourse, setNewCourse] = useState({
    code: '',
    name: '',
    studentIds: [] as string[],
  });
  const [isStudentSelectOpen, setIsStudentSelectOpen] = useState(false);

  const handleAddCourse = () => {
    if (!newCourse.code || !newCourse.name) {
      return;
    }

    const course: Course = {
      code: newCourse.code,
      name: newCourse.name,
      students: newCourse.studentIds.length,
      studentIds: newCourse.studentIds,
      applications: [],
    };

    setCourses([...courses, course]);
    setIsAddDialogOpen(false);
    setNewCourse({ code: '', name: '', studentIds: [] });
  };

  const handleDeleteCourse = (courseCode: string) => {
    setCourses(courses.filter(course => course.code !== courseCode));
  };

  const toggleStudent = (studentId: string) => {
    setNewCourse(prev => ({
      ...prev,
      studentIds: prev.studentIds.includes(studentId)
        ? prev.studentIds.filter(id => id !== studentId)
        : [...prev.studentIds, studentId],
    }));
  };

  const removeStudent = (studentId: string) => {
    setNewCourse(prev => ({
      ...prev,
      studentIds: prev.studentIds.filter(id => id !== studentId),
    }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Läuft</Badge>;
      case 'deploying':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Wird bereitgestellt</Badge>;
      case 'stopped':
        return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Gestoppt</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-slate-900 mb-2">Kurse</h1>
          <p className="text-slate-600">Verwalten Sie Anwendungen für Ihre Kurse</p>
        </div>
        <Button 
          className="bg-teal-500 hover:bg-teal-600 text-white"
          onClick={() => setIsAddDialogOpen(true)}
        >
          <BookOpen className="w-4 h-4 mr-2" />
          Kurs hinzufügen
        </Button>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {courses.map((course) => (
          <Card key={course.code} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-slate-900">{course.code}</span>
                      <p className="text-sm text-slate-600 mt-1">{course.name}</p>
                    </div>
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-slate-300">
                    <Users className="w-3 h-3 mr-1" />
                    {course.students}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteCourse(course.code)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm mb-3">
                  <span className="text-slate-600">Bereitgestellte Anwendungen</span>
                  <span className="text-slate-900">{course.applications.length}</span>
                </div>
                
                <div className="space-y-2">
                  {course.applications.map((app, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-teal-200 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Server className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-900 truncate">{app.name}</p>
                          <p className="text-xs text-slate-500">{app.users} aktive Nutzer</p>
                        </div>
                      </div>
                      {getStatusBadge(app.status)}
                    </div>
                  ))}
                </div>

                <Button variant="ghost" className="w-full mt-4 text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                  Anwendungen verwalten
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Course Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Neuen Kurs hinzufügen</DialogTitle>
            <DialogDescription>
              Geben Sie die Kursinformationen ein und wählen Sie Studenten aus.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Course Code */}
            <div className="space-y-2">
              <Label htmlFor="course-code">Kurscode</Label>
              <Input
                id="course-code"
                placeholder="z.B. CS101"
                value={newCourse.code}
                onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })}
              />
            </div>

            {/* Course Name */}
            <div className="space-y-2">
              <Label htmlFor="course-name">Kursname</Label>
              <Input
                id="course-name"
                placeholder="z.B. Informatik 101"
                value={newCourse.name}
                onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
              />
            </div>

            {/* Student Selection */}
            <div className="space-y-2">
              <Label>Studenten</Label>
              <Popover open={isStudentSelectOpen} onOpenChange={setIsStudentSelectOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isStudentSelectOpen}
                    className="w-full justify-between"
                  >
                    {newCourse.studentIds.length === 0
                      ? "Studenten auswählen..."
                      : `${newCourse.studentIds.length} Student${newCourse.studentIds.length === 1 ? '' : 'en'} ausgewählt`}
                    <ChevronRight className="ml-2 h-4 w-4 shrink-0 opacity-50 rotate-90" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="S-Nummer suchen..." />
                    <CommandList>
                      <CommandEmpty>Keine Studenten gefunden.</CommandEmpty>
                      <CommandGroup>
                        {mockStudents.map((student) => (
                          <CommandItem
                            key={student}
                            onSelect={() => toggleStudent(student)}
                            className="cursor-pointer"
                          >
                            <div className="flex items-center gap-2 flex-1">
                              <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                                newCourse.studentIds.includes(student) 
                                  ? 'bg-teal-500 border-teal-500' 
                                  : 'border-slate-300'
                              }`}>
                                {newCourse.studentIds.includes(student) && (
                                  <Check className="w-3 h-3 text-white" />
                                )}
                              </div>
                              <span>{student}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Selected Students */}
              {newCourse.studentIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  {newCourse.studentIds.map((studentId) => (
                    <Badge
                      key={studentId}
                      variant="outline"
                      className="bg-white border-slate-300 pr-1"
                    >
                      {studentId}
                      <button
                        onClick={() => removeStudent(studentId)}
                        className="ml-1 hover:bg-slate-200 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button 
              className="bg-teal-500 hover:bg-teal-600 text-white"
              onClick={handleAddCourse}
              disabled={!newCourse.code || !newCourse.name}
            >
              Kurs speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}