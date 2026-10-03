module full_adder(input a, b, cin, output sum, cout);
  assign sum = a ^ b ^ cin;
  assign cout = (a & b) | (cin & (a ^ b));
endmodule
module ripple #(parameter N = 4)(input [N-1:0] a, b, input cin, output [N-1:0] s, output cout);
  wire [N:0] c;
  assign c[0] = cin;
  full_adder fa0(a[0], b[0], c[0], s[0], c[1]);
  full_adder fa1(a[1], b[1], c[1], s[1], c[2]);
  full_adder fa2(a[2], b[2], c[2], s[2], c[3]);
  full_adder fa3(a[3], b[3], c[3], s[3], c[4]);
  assign cout = c[N];
endmodule
module tb;
  reg [3:0] a, b; reg cin; wire [3:0] s; wire cout;
  ripple dut(.a(a), .b(b), .cin(cin), .s(s), .cout(cout));
  integer i, j;
  initial begin
    for (i = 0; i < 16; i = i + 5) for (j = 0; j < 16; j = j + 3) begin
      a = i; b = j; cin = i[0]; #1;
      $display("%d + %d + %b = %d (cout %b) check %0d", a, b, cin, s, cout, {cout, s} == a + b + cin);
    end
    $display("width test %d %d", 4'hF + 4'h1, {1'b0, 4'hF} + 4'h1);
    $finish;
  end
endmodule
