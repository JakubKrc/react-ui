import React, { useState } from 'react';
import Input, { type InputProps, InputMetaContext } from '../Input';
import request from '@hubleto/react-ui/core/Request';
import Translator from '@hubleto/react-ui/core/Translator';

interface AttendeesInputProps extends InputProps {
  // Extra classes of the user list, e.g. its height in a given form.
  listCssClass?: string,
}

const T = new Translator('Hubleto\\ReactUi', 'Components\\Inputs\\Attendees');

// The value is a JSON list of user ids; an empty or invalid value means no attendees.
function parseAttendeeIds(value: any): Array<number> {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      parsed = [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  const attendeeIds: Array<number> = [];
  for (const idUser of parsed) attendeeIds.push(Number(idUser));
  return attendeeIds;
}

function getUserName(user: any): string {
  const fullName = ((user.first_name ?? '') + ' ' + (user.last_name ?? '')).trim();
  return fullName !== '' ? fullName : (user.email ?? '');
}

function getAllUsers(input: any): Array<any> {
  const users: Array<any> = [];
  for (const user of Object.values(input.data ?? {})) users.push(user);
  return users;
}

const ValueComponent = () => {
  const input = React.useContext(InputMetaContext);
  const attendeeIds = parseAttendeeIds(input.value);

  const attendeeNames: Array<string> = [];
  for (const user of getAllUsers(input)) {
    if (attendeeIds.includes(Number(user.id))) attendeeNames.push(getUserName(user));
  }

  if (attendeeNames.length === 0) return <span className='text-gray-400'>{T.translate('No attendees')}</span>;
  return <span>{attendeeNames.join(', ')}</span>;
}

// A search box and a small scrollable list of users with checkboxes.
const InputComponent = (props: AttendeesInputProps) => {
  const input = React.useContext(InputMetaContext);
  const [search, setSearch] = useState('');
  const attendeeIds = parseAttendeeIds(input.value);
  const searchedText = search.trim().toLowerCase();

  const listedUsers: Array<any> = [];
  for (const user of getAllUsers(input)) {
    const userText = (getUserName(user) + ' ' + (user.email ?? '')).toLowerCase();
    if (searchedText === '' || userText.includes(searchedText)) listedUsers.push(user);
  }

  function toggleAttendee(idUser: number, isChecked: boolean) {
    const changedIds: Array<number> = [];
    for (const idAttendee of attendeeIds) {
      if (idAttendee !== idUser) changedIds.push(idAttendee);
    }
    if (isChecked) changedIds.push(idUser);
    input.changeValue(JSON.stringify(changedIds));
  }

  // Small by default; a form may give the list another height (listCssClass).
  const listCssClass = 'max-h-40 overflow-y-auto border border-gray-200 rounded p-1 ' + (props.listCssClass ?? '');

  return <div className='flex flex-col gap-1 w-full'>
    <input
      type='text'
      value={search}
      placeholder={T.translate('Search users')}
      onChange={(event) => setSearch(event.target.value)}
    />
    <div className={listCssClass}>
      {listedUsers.map((user: any) => <label key={user.id} className='flex gap-2 items-center justify-start w-fit cursor-pointer'>
        <input
          type='checkbox'
          className='w-auto'
          checked={attendeeIds.includes(Number(user.id))}
          disabled={input.readonly}
          onChange={(event) => toggleAttendee(Number(user.id), event.target.checked)}
        />
        {/* Name and email on two lines, so they fit in a narrow column. */}
        <span className='flex flex-col'>
          <span>{getUserName(user)}</span>
          <span className='text-xs text-gray-400'>{user.email}</span>
        </span>
      </label>)}
    </div>
  </div>;
}

/**
 * Attendees of a record, stored as a JSON list of user ids (e.g. the "attendees" column of calendar activities).
 * A record whose "attendees" column contains a user can be read by that user (Model::getPermissions()).
 */
const InputAttendees = (props: AttendeesInputProps) => {
  return <Input
    inputClassName='attendees'
    onInit={(input: any) => {
      const usersFromCache = globalThis.hubleto.users;
      if (usersFromCache) {
        input.setIsInitialized(true);
        input.setData(usersFromCache);
        return;
      }
      request.post('api/get-users', {}, {}, (users: any) => {
        input.setIsInitialized(true);
        input.setData(users);
        globalThis.hubleto.users = users;
      });
    }}
    renderValueComponent={() => <ValueComponent />}
    renderInputComponent={() => <InputComponent {...props} />}
    {...props}
  />;
}

export default InputAttendees;
