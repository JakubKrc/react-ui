import React, { useState } from 'react';
import Input, { type InputProps, InputMetaContext } from '../Input';
import request from '@hubleto/react-ui/core/Request';
import Translator from '@hubleto/react-ui/core/Translator';

interface MultipleUsersInputProps extends InputProps {
  // Placeholder of the search box, e.g. "Search attendees".
  searchPlaceholder?: string,
  // Shown when no user is selected, e.g. "No attendees".
  emptyText?: string,
  // Offer inactive users too. Selected inactive users are always shown.
  showInactiveUsers?: boolean,
  // Extra classes of the user list, e.g. its height in a given form.
  listCssClass?: string,
}

const T = new Translator('Hubleto\\ReactUi', 'Components\\Inputs\\MultipleUsers');

// The value is a JSON list of user ids; an empty or invalid value means no users.
function parseSelectedIds(value: any): Array<number> {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      parsed = [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  const selectedIds: Array<number> = [];
  for (const idUser of parsed) selectedIds.push(Number(idUser));
  return selectedIds;
}

// The API returns is_active as 1/0 or true/false.
function isUserActive(user: any): boolean {
  return Number(user.is_active) === 1;
}

function getUserName(user: any): string {
  const fullName = ((user.first_name ?? '') + ' ' + (user.last_name ?? '')).trim();
  let userName = fullName !== '' ? fullName : (user.email ?? '');
  if (!isUserActive(user)) userName = userName + ' (' + T.translate('inactive') + ')';
  return userName;
}

function getAllUsers(input: any): Array<any> {
  const users: Array<any> = [];
  for (const user of Object.values(input.data ?? {})) users.push(user);
  return users;
}

const ValueComponent = (props: MultipleUsersInputProps) => {
  const input = React.useContext(InputMetaContext);
  const selectedIds = parseSelectedIds(input.value);

  const selectedNames: Array<string> = [];
  for (const user of getAllUsers(input)) {
    if (selectedIds.includes(Number(user.id))) selectedNames.push(getUserName(user));
  }

  if (selectedNames.length === 0) {
    const emptyText = props.emptyText ?? T.translate('No users selected');
    return <span className='text-gray-400'>{emptyText}</span>;
  }
  return <span>{selectedNames.join(', ')}</span>;
}

// A search box and a small scrollable list of users with checkboxes.
const InputComponent = (props: MultipleUsersInputProps) => {
  const input = React.useContext(InputMetaContext);
  const [search, setSearch] = useState('');
  const selectedIds = parseSelectedIds(input.value);
  const searchedText = search.trim().toLowerCase();

  const listedUsers: Array<any> = [];
  for (const user of getAllUsers(input)) {
    const isSelected = selectedIds.includes(Number(user.id));
    // An inactive user stays in the list while selected, so the user can be removed.
    const isOffered = isUserActive(user) || props.showInactiveUsers === true || isSelected;
    const userText = (getUserName(user) + ' ' + (user.email ?? '')).toLowerCase();
    const matchesSearch = searchedText === '' || userText.includes(searchedText);
    if (isOffered && matchesSearch) listedUsers.push(user);
  }

  function toggleUser(idUser: number, isChecked: boolean) {
    const changedIds: Array<number> = [];
    for (const idSelected of selectedIds) {
      if (idSelected !== idUser) changedIds.push(idSelected);
    }
    if (isChecked) changedIds.push(idUser);
    input.changeValue(JSON.stringify(changedIds));
  }

  // Small by default; a form may give the list another height (listCssClass).
  const listCssClass = 'max-h-40 overflow-y-auto border border-gray-200 rounded p-1 ' + (props.listCssClass ?? '');
  const searchPlaceholder = props.searchPlaceholder ?? T.translate('Search users');

  return <div className='flex flex-col gap-1 w-full'>
    <input
      type='text'
      value={search}
      placeholder={searchPlaceholder}
      onChange={(event) => setSearch(event.target.value)}
    />
    <div className={listCssClass}>
      {listedUsers.map((user: any) => <label key={user.id} className='flex gap-2 items-center justify-start w-fit cursor-pointer'>
        <input
          type='checkbox'
          className='w-auto'
          checked={selectedIds.includes(Number(user.id))}
          disabled={input.readonly}
          onChange={(event) => toggleUser(Number(user.id), event.target.checked)}
        />
        {/* Name and email on two lines, so they fit in a narrow column. */}
        <span className={isUserActive(user) ? 'flex flex-col' : 'flex flex-col text-gray-400'}>
          <span>{getUserName(user)}</span>
          <span className='text-xs text-gray-400'>{user.email}</span>
        </span>
      </label>)}
    </div>
  </div>;
}

/**
 * Selection of several users, stored as a JSON list of user ids
 * (e.g. attendees of an activity, watchers of a task).
 */
const InputMultipleUsers = (props: MultipleUsersInputProps) => {
  return <Input
    inputClassName='multiple-users'
    onInit={(input: any) => {
      // A separate cache: globalThis.hubleto.users holds only the active users.
      const usersFromCache = globalThis.hubleto.usersWithInactive;
      if (usersFromCache) {
        input.setIsInitialized(true);
        input.setData(usersFromCache);
        return;
      }
      request.post('api/get-users', { includeInactive: 1 }, {}, (users: any) => {
        input.setIsInitialized(true);
        input.setData(users);
        globalThis.hubleto.usersWithInactive = users;
      });
    }}
    renderValueComponent={() => <ValueComponent {...props} />}
    renderInputComponent={() => <InputComponent {...props} />}
    {...props}
  />;
}

export default InputMultipleUsers;
