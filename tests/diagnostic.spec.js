describe('itemBlockRegex', () => {
    it('should correctly capture item blocks with components', () => {
        const text = `
            item BucketEmpty {
                DisplayName = Empty Bucket,
                component FluidContainer {
                    capacity = 10.0,
                }
            }
        `;
        const matches = Array.from(text.matchAll(itemBlockRegex));
        expect(matches.length).toBe(1);
        expect(matches[0][1]).toBe('BucketEmpty');
        expect(matches[0][2]).toContain('DisplayName = Empty Bucket');
    });
});
