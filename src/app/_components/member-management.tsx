"use client";
import React, { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import Image from "next/image";

interface MemberManagementProps {
    projectId: number;
}

interface User {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
}

interface Member {
    id: number;
    userId: string;
    role: "Manager" | "Researcher" | "Viewer";
    joinedAt: Date | null;
    name: string | null;
    email: string;
    image: string | null;
}

export const MemberManagement: React.FC<MemberManagementProps> = ({ projectId }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [selectedRole, setSelectedRole] =
        useState<"Manager" | "Researcher" | "Viewer">("Researcher");
    const [isSearching, setIsSearching] = useState(false);

    // Get project members
    const { data: members, refetch: refetchMembers } = api.member.getProjectMembers.useQuery(
        { projectId },
        { enabled: !!projectId }
    );

    // Search for users by email
    const { data: searchResults } = api.member.searchUsersByEmail.useQuery(
        { email: searchTerm, projectId },
        { enabled: isSearching && searchTerm.length >= 3 }
    );

    // Add member mutation
    const addMemberMutation = api.member.addMember.useMutation({
        onSuccess: () => {
            void refetchMembers();
            setShowAddMemberModal(false);
            setSelectedUser(null);
            setSearchTerm("");
        },
        onError: (error) => {
            console.error("Error adding member:", error);
            alert(error.message);
        },
    });

    // Remove member mutation
    const removeMemberMutation = api.member.removeMember.useMutation({
        onSuccess: () => {
            void refetchMembers();
        },
        onError: (error) => {
            console.error("Error removing member:", error);
            alert("Failed to remove member. Please try again.");
        },
    });

    // Handle search input change
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        if (e.target.value.length >= 3) {
            setIsSearching(true);
        } else {
            setIsSearching(false);
        }
    };

    // Handle adding a member
    const handleAddMember = () => {
        if (selectedUser) {
            addMemberMutation.mutate({
                projectId,
                email: selectedUser.email,
                role: selectedRole,
            });
        }
    };

    // Handle removing a member
    const handleRemoveMember = (userId: string) => {
        if (confirm("Are you sure you want to remove this member?")) {
            removeMemberMutation.mutate({ projectId, userId });
        }
    };

    // Reset search when modal is closed
    useEffect(() => {
        if (!showAddMemberModal) {
            setSearchTerm("");
            setSelectedUser(null);
            setIsSearching(false);
        }
    }, [showAddMemberModal]);

    return (
        <div>
            {/* Top Bar: Title + Add Member Button */}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Project Members</h2>
                <button
                    onClick={() => setShowAddMemberModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-2"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path
                            fillRule="evenodd"
                            d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                            clipRule="evenodd"
                        />
                    </svg>
                    Add Member
                </button>
            </div>

            {/* Members Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-md">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="py-2 px-4 text-left font-medium text-gray-700">User</th>
                            <th className="py-2 px-4 text-left font-medium text-gray-700">Role</th>
                            <th className="py-2 px-4 text-left font-medium text-gray-700">Joined</th>
                            <th className="py-2 px-4 text-left font-medium text-gray-700">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {members?.length ? (
                            members.map((member) => (
                                <tr key={member.id} className="hover:bg-gray-50">
                                    <td className="py-2 px-4">
                                        <div className="flex items-center">
                                            {member.image ? (
                                                <div className="h-8 w-8 rounded-full overflow-hidden mr-3">
                                                    <Image
                                                        src={member.image}
                                                        alt={member.name ?? "User"}
                                                        width={32}
                                                        height={32}
                                                        className="object-cover"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                                                    <span className="text-gray-600">
                                                        {member.name?.charAt(0) ?? member.email.charAt(0)}
                                                    </span>
                                                </div>
                                            )}
                                            <div>
                                                <div className="font-medium text-gray-900">
                                                    {member.name ?? "Unnamed User"}
                                                </div>
                                                <div className="text-gray-500 text-xs">{member.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-2 px-4">
                                        <span
                                            className={`px-2 py-1 rounded-full text-xs ${member.role === "Manager"
                                                    ? "bg-purple-100 text-purple-800"
                                                    : member.role === "Researcher"
                                                        ? "bg-blue-100 text-blue-800"
                                                        : "bg-green-100 text-green-800"
                                                }`}
                                        >
                                            {member.role}
                                        </span>
                                    </td>
                                    <td className="py-2 px-4 text-sm text-gray-500">
                                        {member.joinedAt
                                            ? new Date(member.joinedAt).toLocaleDateString()
                                            : "N/A"}
                                    </td>
                                    <td className="py-2 px-4">
                                        <button
                                            onClick={() => handleRemoveMember(member.userId)}
                                            className="text-red-600 hover:text-red-800 text-sm"
                                        >
                                            Remove
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={4} className="py-4 text-center text-gray-500">
                                    No members found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add Member Modal */}
            {showAddMemberModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                    <div className="bg-white p-6 rounded-lg w-96 max-w-md relative">
                        {/* Close button */}
                        <button
                            className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                            onClick={() => setShowAddMemberModal(false)}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <h2 className="text-xl font-semibold mb-4">Add Project Member</h2>

                        {/* Search Field */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Search by Email
                            </label>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={handleSearchChange}
                                placeholder="Enter email address"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {searchTerm.length > 0 && searchTerm.length < 3 && (
                                <p className="text-sm text-gray-500 mt-1">
                                    Type at least 3 characters to search
                                </p>
                            )}
                        </div>

                        {/* Search Results */}
                        {isSearching && searchResults && (
                            <div className="mb-4">
                                <h3 className="text-sm font-medium text-gray-700 mb-2">
                                    Search Results
                                </h3>
                                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md">
                                    {searchResults.length > 0 ? (
                                        <ul className="divide-y divide-gray-200">
                                            {searchResults.map((user) => (
                                                <li
                                                    key={user.id}
                                                    className={`p-2 cursor-pointer hover:bg-gray-50 ${selectedUser?.id === user.id ? "bg-blue-50" : ""
                                                        }`}
                                                    onClick={() => setSelectedUser(user)}
                                                >
                                                    <div className="flex items-center">
                                                        {user.image ? (
                                                            <div className="h-8 w-8 rounded-full overflow-hidden mr-3">
                                                                <Image
                                                                    src={user.image}
                                                                    alt={user.name ?? "User"}
                                                                    width={32}
                                                                    height={32}
                                                                    className="object-cover"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                                                                <span className="text-gray-600">
                                                                    {user.name?.charAt(0) ??
                                                                        user.email.charAt(0)}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div className="font-medium">
                                                                {user.name ?? "Unnamed User"}
                                                            </div>
                                                            <div className="text-sm text-gray-500">
                                                                {user.email}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="p-3 text-sm text-gray-500">No users found</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Selected User */}
                        {selectedUser && (
                            <div className="mb-4">
                                <h3 className="text-sm font-medium text-gray-700 mb-2">
                                    Selected User
                                </h3>
                                <div className="p-3 border border-gray-200 rounded-md bg-gray-50">
                                    <div className="flex items-center">
                                        {selectedUser.image ? (
                                            <div className="h-8 w-8 rounded-full overflow-hidden mr-3">
                                                <Image
                                                    src={selectedUser.image}
                                                    alt={selectedUser.name ?? "User"}
                                                    width={32}
                                                    height={32}
                                                    className="object-cover"
                                                />
                                            </div>
                                        ) : (
                                            <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                                                <span className="text-gray-600">
                                                    {selectedUser.name?.charAt(0) ??
                                                        selectedUser.email.charAt(0)}
                                                </span>
                                            </div>
                                        )}
                                        <div>
                                            <div className="font-medium">
                                                {selectedUser.name ?? "Unnamed User"}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {selectedUser.email}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Role Selection */}
                        {selectedUser && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Assign Role
                                </label>
                                <select
                                    value={selectedRole}
                                    onChange={(e) =>
                                        setSelectedRole(
                                            e.target.value as "Manager" | "Researcher" | "Viewer"
                                        )
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="Manager">Manager</option>
                                    <option value="Researcher">Researcher</option>
                                    <option value="Viewer">Viewer</option>
                                </select>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex justify-end space-x-2">
                            <button
                                onClick={() => setShowAddMemberModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddMember}
                                disabled={!selectedUser}
                                className={`px-4 py-2 rounded-md text-white ${selectedUser
                                        ? "bg-blue-600 hover:bg-blue-700"
                                        : "bg-blue-400 cursor-not-allowed"
                                    }`}
                            >
                                Add Member
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
