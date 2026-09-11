# React Hook Form + Zod - Form Patterns

> Compiled from react-hook-form.com and zod.dev documentation (2024+)

---

## Table of Contents

1. [Setup & Installation](#setup--installation)
2. [Zod Schema Fundamentals](#zod-schema-fundamentals)
3. [Basic Form Integration](#basic-form-integration)
4. [Validation Patterns](#validation-patterns)
5. [Error Handling](#error-handling)
6. [Controller for Controlled Inputs](#controller-for-controlled-inputs)
7. [Field Arrays](#field-arrays)
8. [Nested Objects](#nested-objects)
9. [Form State & Submission](#form-state--submission)
10. [Async Validation](#async-validation)
11. [Multi-Step Forms](#multi-step-forms)
12. [Form with shadcn/ui](#form-with-shadcnui)
13. [File Uploads](#file-uploads)
14. [Advanced Patterns](#advanced-patterns)
15. [Performance Optimization](#performance-optimization)
16. [Testing Forms](#testing-forms)

---

## Setup & Installation

```bash
npm install react-hook-form @hookform/resolvers zod
```

### Basic Imports

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
```

---

## Zod Schema Fundamentals

### Basic Types

```tsx
import { z } from "zod";

// String
z.string();
z.string().min(1, "Required");
z.string().max(255);
z.string().email("Invalid email");
z.string().url();
z.string().regex(/^[A-Z]/, "Must start with uppercase");
z.string().trim();
z.string().toLowerCase();

// Number
z.number();
z.number().min(0);
z.number().max(100);
z.number().int();
z.number().positive();
z.number().multipleOf(5);

// Boolean
z.boolean();

// Date
z.date();
z.date().min(new Date("2024-01-01"));
z.date().max(new Date("2025-12-31"));

// Enum
z.enum(["small", "medium", "large"]);
z.nativeEnum(["GET", "POST", "PUT", "DELETE"]);
```

### Object Schemas

```tsx
// Basic object
const userSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  age: z.number().min(18, "Must be at least 18"),
});

// With optional fields
const profileSchema = z.object({
  name: z.string().min(1),
  bio: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  avatar: z.string().url().optional(),
});

// With defaults
const settingsSchema = z.object({
  theme: z.enum(["light", "dark"]).default("light"),
  notifications: z.boolean().default(true),
  language: z.string().default("en"),
});
```

### Transform & Refine

```tsx
const registrationSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// Transform string to number
const priceSchema = z.object({
  amount: z.string().transform(Number).pipe(
    z.number().positive("Price must be positive")
  ),
});

// Custom validation
const phoneSchema = z.string().refine(
  (val) => /^\+?[\d\s-()]{10,}$/.test(val),
  { message: "Invalid phone number" }
);
```

---

## Basic Form Integration

### Simple Form

```tsx
function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(
      z.object({
        email: z.string().email("Invalid email"),
        password: z.string().min(6, "Password must be at least 6 characters"),
      })
    ),
  });

  const onSubmit = (data) => {
    console.log(data); // { email: "...", password: "..." }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          {...register("email")}
          aria-invalid={errors.email ? "true" : "false"}
        />
        {errors.email && <p role="alert">{errors.email.message}</p>}
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          {...register("password")}
          aria-invalid={errors.password ? "true" : "false"}
        />
        {errors.password && <p role="alert">{errors.password.message}</p>}
      </div>

      <button type="submit">Log In</button>
    </form>
  );
}
```

### Type-Safe Forms

```tsx
import { z } from "zod";
import type { z.infer } from "zod";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormData = z.infer<typeof contactSchema>;

function ContactForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = (data: ContactFormData) => {
    // data is fully typed!
    console.log(data.name, data.email, data.message);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* ... */}
    </form>
  );
}
```

---

## Validation Patterns

### Required Fields

```tsx
const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(1, "Phone is required"),
});
```

### Conditional Validation

```tsx
const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("individual"),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
  }),
  z.object({
    type: z.literal("company"),
    companyName: z.string().min(1),
    taxId: z.string().min(1),
  }),
]);
```

### Dependent Fields

```tsx
const formSchema = z
  .object({
    password: z.string().min(8),
    confirmPassword: z.string(),
    hasDiscount: z.boolean(),
    discountCode: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })
  .refine(
    (data) => !data.hasDiscount || (data.discountCode && data.discountCode.length > 0),
    {
      message: "Discount code is required",
      path: ["discountCode"],
    }
  );
```

### Cross-Field Validation

```tsx
const dateRangeSchema = z
  .object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  });
```

### File Validation

```tsx
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const fileSchema = z.object({
  avatar: z
    .instanceof(File)
    .refine((file) => file.size <= MAX_FILE_SIZE, "Max size is 5MB")
    .refine(
      (file) => ACCEPTED_IMAGE_TYPES.includes(file.type),
      "Only .jpg, .png, .webp formats are supported"
    ),
});
```

---

## Error Handling

### Accessing Errors

```tsx
function MyForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  // Single error
  errors.email?.message;

  // Nested errors
  errors.address?.city?.message;

  // Array errors
  errors.items?.[0]?.name?.message;

  // Check if field has error
  "email" in errors;
}
```

### Error Summary Component

```tsx
function FormErrors({ errors }) {
  const errorMessages = Object.entries(errors).map(([field, error]) => (
    <li key={field}>
      <strong>{field}:</strong> {error.message}
    </li>
  ));

  if (errorMessages.length === 0) return null;

  return (
    <div role="alert" aria-live="polite">
      <h3>Please fix the following errors:</h3>
      <ul>{errorMessages}</ul>
    </div>
  );
}
```

### Error Styling

```tsx
<input
  {...register("email", { required: "Email is required" })}
  className={errors.email ? "input-error" : "input"}
  aria-invalid={errors.email ? "true" : "false"}
  aria-describedby={errors.email ? "email-error" : undefined}
/>
{errors.email && (
  <span id="email-error" className="error-text" role="alert">
    {errors.email.message}
  </span>
)}
```

---

## Controller for Controlled Inputs

Use `Controller` for third-party inputs that can't use `register`.

### Basic Controller

```tsx
import { Controller } from "react-hook-form";

function MyForm() {
  const { control, handleSubmit } = useForm();

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Controller
        name="country"
        control={control}
        rules={{ required: "Country is required" }}
        render={({ field, fieldState }) => (
          <div>
            <Select {...field}>
              <option value="">Select country</option>
              <option value="us">United States</option>
              <option value="uk">United Kingdom</option>
            </Select>
            {fieldState.error && (
              <span className="error">{fieldState.error.message}</span>
            )}
          </div>
        )}
      />
    </form>
  );
}
```

### Controller with react-select

```tsx
<Controller
  name="tags"
  control={control}
  render={({ field }) => (
    <Select
      {...field}
      isMulti
      options={tagOptions}
      onChange={(val) => field.onChange(val.map((v) => v.value))}
      value={tagOptions.filter((o) => field.value?.includes(o.value))}
    />
  )}
/>
```

### Controller with Date Picker

```tsx
<Controller
  name="date"
  control={control}
  render={({ field }) => (
    <DatePicker
      selected={field.value}
      onChange={(date) => field.onChange(date)}
      dateFormat="yyyy-MM-dd"
    />
  )}
/>
```

---

## Field Arrays

Dynamically add/remove fields.

```tsx
import { useFieldArray } from "react-hook-form";

function InvoiceForm() {
  const { register, control, handleSubmit } = useForm({
    resolver: zodResolver(
      z.object({
        items: z.array(
          z.object({
            name: z.string().min(1),
            quantity: z.number().min(1),
            price: z.number().min(0),
          })
        ),
      })
    ),
    defaultValues: {
      items: [{ name: "", quantity: 1, price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {fields.map((field, index) => (
        <div key={field.id} style={{ display: "flex", gap: "8px" }}>
          <input {...register(`items.${index}.name`)} placeholder="Item name" />
          <input
            {...register(`items.${index}.quantity`, { valueAsNumber: true })}
            type="number"
            placeholder="Qty"
          />
          <input
            {...register(`items.${index}.price`, { valueAsNumber: true })}
            type="number"
            placeholder="Price"
          />
          <button type="button" onClick={() => remove(index)}>
            Remove
          </button>
        </div>
      ))}

      <button type="button" onClick={() => append({ name: "", quantity: 1, price: 0 })}>
        Add Item
      </button>

      <button type="submit">Submit</button>
    </form>
  );
}
```

### Field Array with Validation

```tsx
const schema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().min(1, "Title is required"),
        assignee: z.string().min(1, "Assignee is required"),
      })
    )
    .min(1, "At least one task is required"),
});

// Dynamic min/max
const schema = z.object({
  emails: z
    .array(z.string().email())
    .min(1, "At least one email")
    .max(5, "Maximum 5 emails"),
});
```

---

## Nested Objects

```tsx
const schema = z.object({
  user: z.object({
    name: z.string().min(1),
    address: z.object({
      street: z.string().min(1),
      city: z.string().min(1),
      state: z.string().min(2),
      zip: z.string().regex(/^\d{5}$/),
    }),
  }),
});

function AddressForm() {
  const { register, handleSubmit } = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("user.name")} placeholder="Name" />
      <input {...register("user.address.street")} placeholder="Street" />
      <input {...register("user.address.city")} placeholder="City" />
      <input {...register("user.address.state")} placeholder="State" />
      <input {...register("user.address.zip")} placeholder="ZIP" />
    </form>
  );
}
```

---

## Form State & Submission

### Form States

```tsx
function MyForm() {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: {
      errors,
      isSubmitting,
      isSubmitted,
      isSubmitSuccessful,
      isValid,
      isDirty,
      dirtyFields,
      touchedFields,
      submitCount,
    },
  } = useForm({ mode: "onChange" });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* ... */}
      <button type="submit" disabled={isSubmitting || !isValid}>
        {isSubmitting ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
}
```

### Validation Modes

```tsx
// Validate on submit (default)
useForm({ mode: "onSubmit" });

// Validate on blur
useForm({ mode: "onBlur" });

// Validate on change
useForm({ mode: "onChange" });

// Validate on first change, then on blur
useForm({ mode: "onTouched" });

// Validate on all events
useForm({ mode: "all" });

// Re-validate on change after first submit
useForm({ reValidateMode: "onChange" });
```

### Watch Values

```tsx
function MyForm() {
  const { register, watch } = useForm();

  // Watch single field
  const name = watch("name");

  // Watch multiple fields
  const [name, email] = watch(["name", "email"]);

  // Watch all fields
  const allValues = watch();

  // Watch with callback
  watch((data) => {
    console.log("Form changed:", data);
  });
}
```

### Reset & Default Values

```tsx
function EditForm({ item }) {
  const { register, reset, handleSubmit } = useForm({
    defaultValues: {
      name: item.name,
      email: item.email,
    },
  });

  // Reset to new values
  const handleReset = () => {
    reset({
      name: "",
      email: "",
    });
  };

  // Reset with options
  const handleReset2 = () => {
    reset(
      { name: "New Name", email: "new@email.com" },
      { keepErrors: true, keepDirty: true }
    );
  };

  // Reset entire form
  const handleReset3 = () => {
    reset(); // Resets to defaultValues
  };

  return <form onSubmit={handleSubmit(onSubmit)}>...</form>;
}
```

---

## Async Validation

```tsx
const schema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
});

// Async refinement for unique username
const asyncSchema = schema.extend({
  username: z.string().refine(
    async (username) => {
      const response = await fetch(`/api/check-username?value=${username}`);
      const { available } = await response.json();
      return available;
    },
    { message: "Username is already taken" }
  ),
});

function UsernameForm() {
  const { register, handleSubmit } = useForm({
    resolver: zodResolver(asyncSchema),
    mode: "onBlur", // Validate on blur for async
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("username")} placeholder="Username" />
      {/* Async validation runs on blur */}
    </form>
  );
}
```

---

## Multi-Step Forms

```tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const step1Schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const step2Schema = z.object({
  address: z.string().min(1),
  city: z.string().min(1),
});

const step3Schema = z.object({
  cardNumber: z.string().min(16),
  expiry: z.string().min(5),
});

const fullSchema = step1Schema.and(step2Schema).and(step3Schema);

function MultiStepForm() {
  const [step, setStep] = useState(1);
  const form = useForm({
    resolver: zodResolver(step === 1 ? step1Schema : step === 2 ? step2Schema : step3Schema),
    mode: "onBlur",
  });

  const { handleSubmit, trigger, getValues, reset } = form;

  const nextStep = async () => {
    const isValid = await trigger();
    if (isValid) setStep((s) => s + 1);
  };

  const prevStep = () => setStep((s) => s - 1);

  const onSubmit = (data) => {
    console.log("Final data:", data);
    // All steps validated, submit the full form
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {step === 1 && (
        <>
          <input {...form.register("name")} placeholder="Name" />
          <input {...form.register("email")} placeholder="Email" />
          <button type="button" onClick={nextStep}>Next</button>
        </>
      )}

      {step === 2 && (
        <>
          <input {...form.register("address")} placeholder="Address" />
          <input {...form.register("city")} placeholder="City" />
          <button type="button" onClick={prevStep}>Back</button>
          <button type="button" onClick={nextStep}>Next</button>
        </>
      )}

      {step === 3 && (
        <>
          <input {...form.register("cardNumber")} placeholder="Card Number" />
          <input {...form.register("expiry")} placeholder="MM/YY" />
          <button type="button" onClick={prevStep}>Back</button>
          <button type="submit">Submit</button>
        </>
      )}
    </form>
  );
}
```

---

## Form with shadcn/ui

```tsx
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const formSchema = z.object({
  username: z.string().min(2, "Username must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
});

function ProfileForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { username: "", email: "" },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    console.log(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="Username" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="Email" type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
```

---

## File Uploads

```tsx
const fileFormSchema = z.object({
  files: z
    .array(z.instanceof(File))
    .min(1, "At least one file is required")
    .max(5, "Maximum 5 files")
    .refine(
      (files) => files.every((file) => file.size <= 10 * 1024 * 1024),
      "Each file must be under 10MB"
    ),
});

function FileUploadForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(fileFormSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input
        type="file"
        multiple
        {...register("files")}
      />
      {errors.files && <p className="error">{errors.files.message}</p>}
      <button type="submit">Upload</button>
    </form>
  );
}
```

---

## Advanced Patterns

### Dependent Selects

```tsx
const schema = z.object({
  country: z.string().min(1),
  state: z.string().min(1),
  city: z.string().min(1),
});

function DependentSelects() {
  const { register, watch, setValue } = useForm({
    resolver: zodResolver(schema),
  });

  const country = watch("country");
  const state = watch("state");

  // Reset dependent fields when parent changes
  useEffect(() => {
    setValue("state", "");
    setValue("city", "");
  }, [country]);

  useEffect(() => {
    setValue("city", "");
  }, [state]);

  return (
    <form>
      <select {...register("country")}>
        <option value="">Select country</option>
        <option value="us">United States</option>
        <option value="ca">Canada</option>
      </select>

      <select {...register("state")} disabled={!country}>
        <option value="">Select state</option>
        {statesForCountry[country]?.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <select {...register("city")} disabled={!state}>
        <option value="">Select city</option>
        {citiesForState[state]?.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </form>
  );
}
```

### Dynamic Form Builder

```tsx
const fieldSchema = z.object({
  fields: z.array(
    z.object({
      name: z.string(),
      label: z.string(),
      type: z.enum(["text", "email", "number", "select"]),
      required: z.boolean().default(false),
      options: z.array(z.string()).optional(),
    })
  ),
});

function DynamicForm({ fields, onSubmit }) {
  const schema = z.object(
    fields.reduce((acc, field) => {
      let fieldSchema = z.string();
      if (field.type === "number") fieldSchema = z.string().transform(Number).pipe(z.number());
      if (field.required) fieldSchema = fieldSchema.min(1, `${field.label} is required`);
      if (field.type === "email") fieldSchema = z.string().email("Invalid email");
      acc[field.name] = fieldSchema;
      return acc;
    }, {} as Record<string, z.ZodTypeAny>)
  );

  const { register, handleSubmit } = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {fields.map((field) => (
        <div key={field.name}>
          <label htmlFor={field.name}>{field.label}</label>
          {field.type === "select" ? (
            <select {...register(field.name)}>
              <option value="">Select...</option>
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input
              id={field.name}
              type={field.type}
              {...register(field.name)}
            />
          )}
        </div>
      ))}
      <button type="submit">Submit</button>
    </form>
  );
}
```

---

## Performance Optimization

```tsx
// 1. Avoid re-renders with shouldFocusError
useForm({
  shouldFocusError: true, // Focus first error field
  criteriaMode: "all",    // Return all validation errors
});

// 2. Use mode: "onBlur" for expensive validation
useForm({
  mode: "onBlur",
  reValidateMode: "onChange",
});

// 3. Minimize register calls
const { register } = useForm({
  defaultValues: {
    name: "",
    email: "",
  },
});

// 4. Use shouldUnregister for dynamic fields
<input {...register("field", { shouldUnregister: true })} />

// 5. Reset only specific fields
const { resetField } = useForm();
resetField("email", { defaultValue: "" });
```

---

## Testing Forms

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

test("validates required fields", async () => {
  render(<ContactForm />);
  const user = userEvent.setup();

  // Submit empty form
  await user.click(screen.getByRole("button", { name: /submit/i }));

  // Check for errors
  expect(screen.getByText("Name is required")).toBeInTheDocument();
  expect(screen.getByText("Email is required")).toBeInTheDocument();
});

test("validates email format", async () => {
  render(<ContactForm />);
  const user = userEvent.setup();

  await user.type(screen.getByRole("textbox", { name: /email/i }), "bad-email");
  await user.click(screen.getByRole("button", { name: /submit/i }));

  expect(screen.getByText("Invalid email address")).toBeInTheDocument();
});

test("submits valid form", async () => {
  const onSubmit = vi.fn();
  render(<ContactForm onSubmit={onSubmit} />);
  const user = userEvent.setup();

  await user.type(screen.getByRole("textbox", { name: /name/i }), "John");
  await user.type(screen.getByRole("textbox", { name: /email/i }), "john@example.com");
  await user.click(screen.getByRole("button", { name: /submit/i }));

  expect(onSubmit).toHaveBeenCalledWith({
    name: "John",
    email: "john@example.com",
  });
});
```

---

*Sources: react-hook-form.com, zod.dev*
