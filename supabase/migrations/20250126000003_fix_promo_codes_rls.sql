-- Drop existing admin policy
DROP POLICY IF EXISTS "Admins can manage promo codes" ON public.promo_codes;

-- Create better admin policy for all operations
CREATE POLICY "Admins can manage promo codes"
ON public.promo_codes
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Also allow insert for authenticated admins specifically
CREATE POLICY "Authenticated admins can insert promo codes"
ON public.promo_codes
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);
