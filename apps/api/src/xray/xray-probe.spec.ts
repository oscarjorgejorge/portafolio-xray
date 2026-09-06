import { buildXRayProbeUrl, evaluateXRayProbeHtml } from './xray-probe';

describe('xray-probe', () => {
  describe('buildXRayProbeUrl', () => {
    it('should build a single-holding Instant X-Ray URL', () => {
      const url = buildXRayProbeUrl('https://lt.morningstar.com', 'F00000WI0D');
      expect(url).toContain('/j2uwuwirpv/xraypdf/default.aspx');
      expect(url).toContain('F00000WI0D');
      expect(url).toContain('values=10000');
    });
  });

  describe('evaluateXRayProbeHtml', () => {
    it('should accept a report that contains the fund name', () => {
      const html =
        '<html>Posiciones de Cartera Azvalor Internacional FI Fondo 50,00</html>';
      expect(evaluateXRayProbeHtml(html, 'Azvalor Internacional FI')).toEqual({
        ok: true,
        reason: 'ok',
      });
    });

    it('should reject Fondo no disponible', () => {
      const html = '<html>Fondo no disponible - 5000,00 50,00</html>';
      expect(evaluateXRayProbeHtml(html, 'Azvalor Internacional FI')).toEqual({
        ok: false,
        reason: 'xray_unavailable',
      });
    });

    it('should reject a blank name row', () => {
      const html =
        '<html>Las 10 mayores posiciones Nombre Activos 50,00</html>';
      expect(
        evaluateXRayProbeHtml(html, 'Buy & Hold Luxembourg B&H Bond Class 1'),
      ).toEqual({ ok: false, reason: 'name_not_in_report' });
    });
  });
});
