'use server';

import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
 
const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
      invalid_type_error: '请选择一个客户。',
    }),
    amount: z.coerce
      .number()
      .gt(0, { message: '请输入大于 $0的数。' }),
    status: z.enum(['pending', 'paid'], {
      invalid_type_error: '请选择一个状态。',
    }),
    date: z.string(),
  });

const CreateInvoice = FormSchema.omit({id: true, date: true});

export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
      };
    message?: string | null;
}


export async function createInvoice(prevState: State, formData: FormData) {
    // // Logic to create invoice...
    // const { customerId, amount, status } = CreateInvoice.parse({
    //     customerId: formData.get('customerId'),
    //     amount: formData.get('amount'),
    //     status: formData.get('status'),
    // });
     // Validate form fields using Zod
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    // If form validation fails, return errors early. Otherwise, continue.
    if (!validatedFields.success) {
        return {
        errors: validatedFields.error.flatten().fieldErrors,
        message: '缺少字段。无法创建发票。',
        };
    }

    // Prepare data for insertion into the database
    const { customerId, amount, status } = validatedFields.data;

    const amountInCents = amount * 100;

    const date = new Date().toISOString().split('T')[0];

    // 插入数据到数据库中
    try{
        await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
    } catch (error) {
        // If a database error occurs, return a more specific error.
        return {
            message: `数据库错误，创建发票失败。 错误信息： ${error}`
        }
    }

    
     // Revalidate the cache for the invoices page and redirect the user.
    revalidatePath('/dashboard/invoices');
    redirect("/dashboard/invoices");
}


export async function updateInvoice(id: string, prevState: State, formData: FormData) {
    // const { customerId, amount, status } = UpdateInvoice.parse({
    //   customerId: formData.get('customerId'),
    //   amount: formData.get('amount'),
    //   status: formData.get('status'),
    // });

    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    if (!validatedFields.success) {
        return {
          errors: validatedFields.error.flatten().fieldErrors,
          message: '缺失字段， 更新发票失败。',
        };
      }
     
    const { customerId, amount, status } = validatedFields.data;
   
    const amountInCents = amount * 100;
   
    try {
        await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
        `;
    } catch (error) {
        return {
            message: `数据库错误，更新发票失败。错误信息： ${error}`
        }
    }
        
   
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
  }


export async function deleteInvoice(id: string) {
    // throw new Error('失败删除发票');

    // Unreachable code block
    try {
        await sql`DELETE FROM invoices WHERE id = ${id}`;
        revalidatePath('/dashboard/invoices');
        return {
            message: "删除发票"
        }
    } catch ( error) {
        return {
            message: `数据库错误，删除发票失败。错误信息${error} `
        }
    }
}

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
  ) {
    try {
      await signIn('credentials', formData);
    } catch (error) {
      if (error instanceof AuthError) {
        switch (error.type) {
          case 'CredentialsSignin':
            return '无效认证。';
          default:
            return '报错了。';
        }
      }
      throw error;
    }
  }