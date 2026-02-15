import { useState } from 'react';
import MeetingRecorder from './MeetingRecorder';

const DEMO_MEETINGS = [
  {
    id: 1,
    title: 'Team Standup',
    description: 'Daily team sync meeting',
    date: '2026-02-02',
    time: '10:00 AM'
  },
  {
    id: 2,
    title: 'Project Review',
    description: 'Q1 project milestone review',
    date: '2026-02-02',
    time: '2:00 PM'
  },
  {
    id: 3,
    title: 'Client Meeting',
    description: 'Requirements discussion with client',
    date: '2026-02-03',
    time: '11:00 AM'
  },
  {
    id: 4,
    title: 'Sprint Planning',
    description: 'Plan tasks for the next sprint',
    date: '2026-02-03',
    time: '3:00 PM'
  }
];

function MeetingList() {
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  const handleMeetingClick = (meeting) => {
    setSelectedMeeting(meeting);
  };

  const handleBackToList = () => {
    setSelectedMeeting(null);
  };

  if (selectedMeeting) {
    return (
      <MeetingRecorder 
        meeting={selectedMeeting} 
        onBack={handleBackToList} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Meetings</h1>
        <p className="text-gray-600 mb-8">Select a meeting to start recording</p>
        
        <div className="grid gap-4 md:grid-cols-2">
          {DEMO_MEETINGS.map((meeting) => (
            <div
              key={meeting.id}
              onClick={() => handleMeetingClick(meeting)}
              className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow border border-gray-200"
            >
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {meeting.title}
              </h2>
              <p className="text-gray-600 mb-4">{meeting.description}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  📅 {meeting.date}
                </span>
                <span className="flex items-center gap-1">
                  🕐 {meeting.time}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MeetingList;
