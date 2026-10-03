module mux4(sel, d0, d1, d2, d3, y);
  input [1:0] sel; input [3:0] d0, d1, d2, d3; output [3:0] y;
  wire [3:0] lo = sel[0] ? d1 : d0;
  wire [3:0] hi = sel[0] ? d3 : d2;
  assign y = sel[1] ? hi : lo;
endmodule
module dec(in, out); input [1:0] in; output reg [3:0] out;
  always @(in) out = 4'b0001 << in;
endmodule
module tb;
  reg [1:0] s; wire [3:0] y, d; integer i;
  mux4 m(s, 4'h1, 4'h2, 4'h4, 4'h8, y);
  dec q(s, d);
  initial for (i = 0; i < 4; i = i + 1) begin s = i; #1 $display("sel=%d y=%h dec=%b", s, y, d); end
endmodule
