# Firestore Security Specification

## Data Invariants
1. **Customers**: Must have a name and phone. IDs must be valid.
2. **Equipment**: Catalog items must have valid types, brand, and unit price.
3. **Projects**: Must be linked to a valid customer and have a valid status.
4. **Sales Staff**: Must have a name, email, and role.
5. **Sales Tasks**: Must be linked to a project.

## The "Dirty Dozen" Payloads (Denial Targets)
1. Write to `customers` without a name.
2. Update `customer` phone to a 1MB string.
3. Create `equipment` with an invalid type (e.g., "rocket_launcher").
4. Update `equipment` price to a negative value.
5. Create `project` with an invalid status.
6. Injection attack: Create a document with ID `../../secrets/config`.
7. Spoof: Create a project claiming to be completed without going through steps.
8. Role escalation: Update a sales staff role to `admin` if such a role existed.
9. Ghost fields: Adding `isVerified: true` to a customer profile.
10. Orphaned Tasks: Creating a task without a `projectId`.
11. Bypassing validation: Updating a project cost without being signed in.
12. Data scraping: Listing all projects without authentication.

## Test Runner (Planned)
We will verify that these payloads return `PERMISSION_DENIED` using the optimized rules.
